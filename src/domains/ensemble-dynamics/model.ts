/** Deterministic ensemble model owned by the ensemble-dynamics domain. */
import { assertNonNegativeFinite, assertPositiveFinite } from "../../shared/numeric/validation";
import { assertValidEnsembleConfig, textureProfile } from "./config";
import type { EnsembleConfig } from "./config";

export type Oscillator = {
  phase: number;
  omega: number;
};

export type CouplingEdge = {
  from: number;
  to: number;
  strength: number;
  delaySeconds: number;
};

export type EnsembleState = {
  time: number;
  oscillators: Oscillator[];
};

const TAU = Math.PI * 2;

// Exported for model.reference.test-helper.ts.
export function normalizePhase(phase: number): number {
  const wrapped = phase % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

// Exported for model.reference.test-helper.ts.
export function circularDifference(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function bpmToRadPerSecond(tempoBpm: number): number {
  return (tempoBpm / 60) * TAU;
}

function initialPhaseFor(index: number, count: number): number {
  const imperfectCircle = (TAU * index) / count + 0.41 * Math.sin((index + 1) * 1.73);
  return normalizePhase(imperfectCircle);
}

// Exported for model.test.ts.
export function delayedOscillatorPhase(
  history: readonly EnsembleState[],
  fallback: EnsembleState,
  oscillatorIndex: number,
  targetTime: number,
): number {
  if (targetTime <= 0 || history.length === 0) {
    return oscillatorPhaseOrZero(fallback, oscillatorIndex);
  }

  let lower = 0;
  let upper = history.length;
  while (lower < upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    const entry = history[middle];
    if (entry && entry.time <= targetTime) {
      lower = middle + 1;
    } else {
      upper = middle;
    }
  }

  const candidate = history[lower - 1];
  if (!candidate) return oscillatorPhaseOrZero(fallback, oscillatorIndex);
  const oscillator = candidate.oscillators.at(oscillatorIndex);
  if (!oscillator) {
    throw new RangeError("delayed coupling history is missing the requested source oscillator.");
  }
  return oscillator.phase;
}

// Exported for model.reference.test-helper.ts.
export function effectiveDelaySeconds(
  edge: CouplingEdge,
  config: EnsembleConfig,
  time: number,
): number {
  if (config.jitterSeconds <= 0) return edge.delaySeconds;
  const frameSeconds = 0.025;
  const frame = Math.floor(time / frameSeconds);
  const blend = time / frameSeconds - frame;
  const previous = deterministicNoise(edge.from, edge.to, frame);
  const next = deterministicNoise(edge.from, edge.to, frame + 1);
  const smoothBlend = blend * blend * (3 - 2 * blend);
  const jitter = previous + (next - previous) * smoothBlend;
  return Math.max(0, edge.delaySeconds + jitter * config.jitterSeconds);
}

// Exported for model.reference.test-helper.ts.
export function feedbackReliability(config: EnsembleConfig): number {
  if (config.jitterSeconds <= 0) return 1;
  const profile = textureProfile(config.repertoireTexture);
  const jitterRatio = config.jitterSeconds / Math.max(config.latencySeconds, 0.01);
  return Math.max(0.08, 1 - jitterRatio * 1.35 * profile.jitterPenaltyMultiplier);
}

// Exported for model.reference.test-helper.ts.
export function clickTrackPull(time: number, phase: number, config: EnsembleConfig): number {
  if (config.clickTrackStrength <= 0) return 0;
  const profile = textureProfile(config.repertoireTexture);
  const clickPhase = normalizePhase(bpmToRadPerSecond(config.tempoBpm) * time);
  return config.clickTrackStrength
    * profile.clickTrackMultiplier
    * Math.sin(circularDifference(phase, clickPhase));
}

// Exported for model.reference.test-helper.ts.
export function trimHistory(history: EnsembleState[], keepSeconds: number): void {
  const latest = history.at(-1);
  if (!latest) return;
  const cutoff = latest.time - keepSeconds;
  while (history.length > 2) {
    const earliest = history.at(0);
    if (!earliest || earliest.time >= cutoff) break;
    history.shift();
  }
}

function oscillatorPhaseOrZero(state: EnsembleState, oscillatorIndex: number): number {
  const oscillator = state.oscillators.at(oscillatorIndex);
  return oscillator ? oscillator.phase : 0;
}

function deterministicNoise(from: number, to: number, frame: number): number {
  const seed = (from + 1) * 12.9898 + (to + 1) * 78.233 + (frame + 1) * 37.719;
  const sine = Math.sin(seed) * 43758.5453;
  return (sine - Math.floor(sine)) * 2 - 1;
}

function assertValidCouplingEdges(
  edges: readonly CouplingEdge[],
  oscillatorCount: number,
): void {
  for (const edge of edges) {
    assertValidOscillatorIndex("edge.from", edge.from, oscillatorCount);
    assertValidOscillatorIndex("edge.to", edge.to, oscillatorCount);
    if (!Number.isFinite(edge.strength)) {
      throw new RangeError("edge.strength must be finite.");
    }
    assertNonNegativeFinite("edge.delaySeconds", edge.delaySeconds);
  }
}

function assertValidOscillatorIndex(name: string, value: number, oscillatorCount: number): void {
  if (!Number.isInteger(value) || value < 0 || value >= oscillatorCount) {
    throw new RangeError(`${name} must reference an existing oscillator.`);
  }
}

const FIXED_STEP_EPSILON_SECONDS = 1e-10;

export type EnsembleMetrics = {
  coherence: number;
  phaseSpread: number;
  /**
   * Phase spread expressed as the period-equivalent time at the ensemble's
   * current mean natural frequency. It is a model-derived conversion, not a
   * measured onset or network timing error.
   */
  phaseSpreadEquivalentMs: number;
  /** Positive values mean the leader is ahead of the mean follower phase. */
  leaderToFollowerPhaseLagMs: number | null;
  /** Consecutive two-player section coherences; null outside sections mode. */
  sectionCoherences: readonly number[] | null;
  peerCouplingShare: number;
  modelLatencyBudgetSeconds: number;
};

export type SimulationSample = {
  state: EnsembleState;
  metrics: EnsembleMetrics;
};

export type SimulationResult = {
  samples: SimulationSample[];
  finalState: EnsembleState;
  finalMetrics: EnsembleMetrics;
};

type SimulationProgress = {
  state: EnsembleState;
  history: EnsembleState[];
  samples: SimulationSample[];
  nextSampleTime: number;
};

type AdvanceSimulationInput = Readonly<{
  progress: SimulationProgress;
  config: EnsembleConfig;
  incomingEdges: OrderedIncomingEdges;
  stepSeconds: number;
  canonicalTime: number;
  sampleInterval: number;
}>;

type OrderedIncomingEdges = readonly (readonly CouplingEdge[])[];

function coherence(oscillators: readonly Oscillator[]): number {
  if (oscillators.length === 0) {
    return 0;
  }

  const sum = phaseVectorSum(oscillators);
  return Math.hypot(sum.x, sum.y) / oscillators.length;
}

function meanPhase(oscillators: readonly Oscillator[]): number {
  if (oscillators.length === 0) {
    return 0;
  }

  const sum = phaseVectorSum(oscillators);
  return normalizePhase(Math.atan2(sum.y, sum.x));
}

function phaseVectorSum(oscillators: readonly Oscillator[]): { x: number; y: number } {
  return oscillators.reduce(
    (acc, oscillator) => ({
      x: acc.x + Math.cos(oscillator.phase),
      y: acc.y + Math.sin(oscillator.phase),
    }),
    { x: 0, y: 0 },
  );
}

function phaseSpread(oscillators: readonly Oscillator[]): number {
  const center = meanPhase(oscillators);
  const squaredError = oscillators.reduce((sum, oscillator) => {
    const error = circularDifference(center, oscillator.phase);
    return sum + error * error;
  }, 0);

  return Math.sqrt(squaredError / Math.max(oscillators.length, 1));
}

function idealizedPhaseBudgetSeconds(tempoBpm: number): number {
  return Math.PI / (2 * bpmToRadPerSecond(tempoBpm));
}

export function modelLatencyBudgetSeconds(config: EnsembleConfig): number {
  assertValidEnsembleConfig(config);
  return idealizedPhaseBudgetSeconds(config.tempoBpm) *
    textureProfile(config.repertoireTexture).latencyBudgetMultiplier;
}

export function peerCouplingShare(config: EnsembleConfig): number {
  assertValidEnsembleConfig(config);
  const peer = Math.max(0, config.couplingStrength);
  const click = Math.max(0, config.clickTrackStrength);
  if (peer + click === 0) {
    return 0;
  }

  return peer / (peer + click);
}

function phaseSpreadEquivalentMs(state: EnsembleState): number {
  const averageOmega =
    state.oscillators.reduce((sum, oscillator) => sum + oscillator.omega, 0) /
    Math.max(state.oscillators.length, 1);
  const spread = phaseSpread(state.oscillators);
  return (spread / Math.max(averageOmega, 0.001)) * 1000;
}

function leaderToFollowerPhaseLagMs(
  state: EnsembleState,
  config: EnsembleConfig,
): number | null {
  if (config.topology !== "leader-follower" || state.oscillators.length < 2) {
    return null;
  }

  const leader = state.oscillators.at(0);
  const followers = state.oscillators.slice(1);
  if (!leader) {
    return null;
  }

  const followerPhase = meanPhase(followers);
  const leaderAheadPhase = circularDifference(followerPhase, leader.phase);
  return (leaderAheadPhase / Math.max(leader.omega, 0.001)) * 1000;
}

function sectionCoherences(state: EnsembleState, config: EnsembleConfig): readonly number[] | null {
  if (config.topology !== "sections") {
    return null;
  }

  const values: number[] = [];
  for (let start = 0; start < state.oscillators.length; start += 2) {
    values.push(coherence(state.oscillators.slice(start, start + 2)));
  }
  return values;
}

export function metricsFor(state: EnsembleState, config: EnsembleConfig): EnsembleMetrics {
  assertValidEnsembleConfig(config);
  return {
    coherence: coherence(state.oscillators),
    phaseSpread: phaseSpread(state.oscillators),
    phaseSpreadEquivalentMs: phaseSpreadEquivalentMs(state),
    leaderToFollowerPhaseLagMs: leaderToFollowerPhaseLagMs(state, config),
    sectionCoherences: sectionCoherences(state, config),
    peerCouplingShare: peerCouplingShare(config),
    modelLatencyBudgetSeconds: modelLatencyBudgetSeconds(config),
  };
}

export function createInitialState(config: EnsembleConfig): EnsembleState {
  assertValidEnsembleConfig(config);
  const count = config.musicianCount;

  const oscillators = Array.from({ length: count }, (_, index) => {
    return {
      phase: initialPhaseFor(index, count),
      omega: naturalOmegaFor(index, count, config),
    };
  });

  return {
    time: 0,
    oscillators,
  };
}

function naturalOmegaFor(index: number, count: number, config: EnsembleConfig): number {
  assertValidEnsembleConfig(config);
  const centered = count <= 1 ? 0 : (index / (count - 1) - 0.5) * 2;
  const profile = textureProfile(config.repertoireTexture);
  const spreadOmega = bpmToRadPerSecond(config.tempoSpreadBpm * profile.tempoSpreadMultiplier);
  return bpmToRadPerSecond(config.tempoBpm) + centered * spreadOmega;
}

export function createCouplingEdges(config: EnsembleConfig): CouplingEdge[] {
  assertValidEnsembleConfig(config);
  return config.topology === "leader-follower"
    ? createLeaderFollowerEdges(config)
    : createPeerCouplingEdges(config);
}

const createLeaderFollowerEdges = (config: EnsembleConfig): CouplingEdge[] => {
  return Array.from({ length: config.musicianCount - 1 }, (_, index) => {
    return couplingEdge(0, index + 1, config.couplingStrength, config.latencySeconds);
  });
};

const createPeerCouplingEdges = (config: EnsembleConfig): CouplingEdge[] => {
  return orderedOscillatorPairs(config.musicianCount).map(({ from, to }) => {
    return couplingEdge(
      from,
      to,
      config.couplingStrength * sectionCouplingMultiplier(config.topology, from, to),
      config.latencySeconds,
    );
  });
};

const orderedOscillatorPairs = (count: number): Array<Pick<CouplingEdge, "from" | "to">> => {
  return Array.from({ length: count }, (_, from) =>
    Array.from({ length: count - 1 }, (_, index) => ({
      from,
      to: index < from ? index : index + 1,
    })),
  ).flat();
};

const sectionCouplingMultiplier = (topology: EnsembleConfig["topology"], from: number, to: number): number => {
  if (topology !== "sections") return 1;
  return Math.floor(from / 2) === Math.floor(to / 2) ? 1 : 0.35;
};

const couplingEdge = (
  from: number,
  to: number,
  strength: number,
  delaySeconds: number,
): CouplingEdge => ({ from, to, strength, delaySeconds });

export function stepEnsemble(
  state: EnsembleState,
  config: EnsembleConfig,
  edges: readonly CouplingEdge[],
  history: readonly EnsembleState[],
  dtSeconds: number,
): EnsembleState {
  assertValidEnsembleConfig(config);
  const incomingEdges = prepareIncomingEdges(edges, state.oscillators.length);
  return stepEnsembleWithIncoming(state, config, incomingEdges, history, dtSeconds);
}

function prepareIncomingEdges(
  edges: readonly CouplingEdge[],
  oscillatorCount: number,
): OrderedIncomingEdges {
  assertValidCouplingEdges(edges, oscillatorCount);
  const incomingEdges: CouplingEdge[][] = Array.from(
    { length: oscillatorCount },
    () => [],
  );
  for (const edge of edges) {
    incomingEdges[edge.to]?.push(edge);
  }
  return incomingEdges;
}

function stepEnsembleWithIncoming(
  state: EnsembleState,
  config: EnsembleConfig,
  incomingEdges: OrderedIncomingEdges,
  history: readonly EnsembleState[],
  dtSeconds: number,
): EnsembleState {
  const profile = textureProfile(config.repertoireTexture);
  const nextOscillators = state.oscillators.map((oscillator, index) => {
    const incoming = incomingEdges[index] ?? [];
    const peerPull = incoming.reduce((sum, edge) => {
      const delay = effectiveDelaySeconds(edge, config, state.time);
      const delayedPhase = delayedOscillatorPhase(history, state, edge.from, state.time - delay);
      return (
        sum +
        edge.strength *
          profile.peerCouplingMultiplier *
          feedbackReliability(config) *
          Math.sin(circularDifference(oscillator.phase, delayedPhase))
      );
    }, 0);

    const normalizedPeerPull =
      incoming.length === 0 ? 0 : peerPull / Math.sqrt(incoming.length);
    const clickPull = clickTrackPull(state.time, oscillator.phase, config);
    const omega = oscillator.omega + normalizedPeerPull + clickPull;

    return {
      phase: normalizePhase(oscillator.phase + omega * dtSeconds),
      omega: oscillator.omega,
    };
  });

  return {
    time: state.time + dtSeconds,
    oscillators: nextOscillators,
  };
}

function advanceSimulationStep(input: AdvanceSimulationInput): SimulationProgress {
  const { progress, config, incomingEdges, stepSeconds, canonicalTime, sampleInterval } = input;
  progress.history.push(progress.state);
  trimHistory(
    progress.history,
    Math.max(1, config.latencySeconds + config.jitterSeconds + 0.5),
  );
  const advanced = stepEnsembleWithIncoming(
    progress.state,
    config,
    incomingEdges,
    progress.history,
    stepSeconds,
  );
  const state = { ...advanced, time: canonicalTime };
  let nextSampleTime = progress.nextSampleTime;

  if (state.time + FIXED_STEP_EPSILON_SECONDS >= nextSampleTime) {
    progress.samples.push({ state, metrics: metricsFor(state, config) });
    while (nextSampleTime <= state.time + FIXED_STEP_EPSILON_SECONDS) {
      nextSampleTime += sampleInterval;
    }
  }

  return { ...progress, state, nextSampleTime };
}

export function simulateEnsemble(
  config: EnsembleConfig,
  durationSeconds: number,
  dtSeconds = 0.01,
): SimulationResult {
  assertValidEnsembleConfig(config);
  assertNonNegativeFinite("durationSeconds", durationSeconds);
  assertPositiveFinite("dtSeconds", dtSeconds);

  const edges = createCouplingEdges(config);
  const incomingEdges = prepareIncomingEdges(edges, config.musicianCount);
  const sampleInterval = 0.1;
  let progress: SimulationProgress = {
    state: createInitialState(config),
    history: [],
    samples: [],
    nextSampleTime: 0,
  };
  const fullStepCount = Math.floor(
    (durationSeconds + FIXED_STEP_EPSILON_SECONDS) / dtSeconds,
  );

  for (let stepIndex = 0; stepIndex < fullStepCount; stepIndex += 1) {
    progress = advanceSimulationStep({
      progress,
      config,
      incomingEdges,
      stepSeconds: dtSeconds,
      canonicalTime: Math.min(durationSeconds, (stepIndex + 1) * dtSeconds),
      sampleInterval,
    });
  }

  const remainderSeconds = durationSeconds - fullStepCount * dtSeconds;
  if (remainderSeconds > FIXED_STEP_EPSILON_SECONDS) {
    progress = advanceSimulationStep({
      progress,
      config,
      incomingEdges,
      stepSeconds: remainderSeconds,
      canonicalTime: durationSeconds,
      sampleInterval,
    });
  }

  const finalMetrics = metricsFor(progress.state, config);
  return {
    samples: progress.samples,
    finalState: progress.state,
    finalMetrics,
  };
}
