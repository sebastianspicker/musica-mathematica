import { assertValidEnsembleConfig, textureProfile } from "./ensembleConfig";
import {
  clickTrackPull,
  delayedOscillatorPhase,
  effectiveDelaySeconds,
  feedbackReliability,
  trimHistory,
} from "./ensembleRuntime";
import {
  bpmToRadPerSecond,
  circularDifference,
  initialPhaseFor,
  nearlyEqual,
  normalizePhase,
} from "./ensembleMath";
import {
  assertFiniteNonNegative,
  assertFinitePositive,
  assertValidCouplingEdges,
} from "./ensembleValidation";
import type {
  EnsembleConfig,
} from "./ensembleConfig";

export { ensembleConfigBounds, textureProfile } from "./ensembleConfig";
export type {
  EnsembleConfig,
  RepertoireTexture,
  TextureProfile,
  Topology,
} from "./ensembleConfig";

const FIXED_STEP_EPSILON_SECONDS = 1e-10;

/**
 * Integration interval used by the browser simulation loop. Rendering may be
 * irregular, but model integration always advances in these fixed increments.
 */
export const fixedSimulationStepSeconds = 0.01;

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

export type ModelLatencyBudgetStatus = "plausible" | "fragile" | "unstable";

export type SimulationSample = {
  state: EnsembleState;
  metrics: EnsembleMetrics;
};

export type SimulationResult = {
  samples: SimulationSample[];
  finalState: EnsembleState;
  finalMetrics: EnsembleMetrics;
};

/** State retained between render frames by the fixed-step browser driver. */
export type FixedStepSimulation = {
  state: EnsembleState;
  history: EnsembleState[];
  accumulatorSeconds: number;
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
  edges: readonly CouplingEdge[];
  stepSeconds: number;
  canonicalTime: number;
  sampleInterval: number;
}>;

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

export function modelLatencyBudgetRatio(
  config: EnsembleConfig,
  metrics: Pick<EnsembleMetrics, "modelLatencyBudgetSeconds">,
): number {
  assertValidEnsembleConfig(config);
  return config.latencySeconds / Math.max(metrics.modelLatencyBudgetSeconds, 0.001);
}

export function modelLatencyBudgetStatus(
  config: EnsembleConfig,
  metrics: Pick<EnsembleMetrics, "modelLatencyBudgetSeconds">,
): ModelLatencyBudgetStatus {
  const ratio = modelLatencyBudgetRatio(config, metrics);
  if (ratio >= 0.85) {
    return "unstable";
  }
  if (ratio >= 0.55) {
    return "fragile";
  }
  return "plausible";
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

  const [leader, ...followers] = state.oscillators;
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

export function retuneState(state: EnsembleState, config: EnsembleConfig): EnsembleState {
  assertValidEnsembleConfig(config);
  const count = config.musicianCount;
  const oscillators = Array.from({ length: count }, (_, index) => {
    const existing = state.oscillators[index];
    return {
      phase: existing?.phase ?? initialPhaseFor(index, count),
      omega: naturalOmegaFor(index, count, config),
    };
  });

  return {
    time: state.time,
    oscillators,
  };
}

export function configsEqual(left: EnsembleConfig, right: EnsembleConfig): boolean {
  assertValidEnsembleConfig(left);
  assertValidEnsembleConfig(right);

  return (
    nearlyEqual(left.musicianCount, right.musicianCount) &&
    nearlyEqual(left.tempoBpm, right.tempoBpm) &&
    nearlyEqual(left.tempoSpreadBpm, right.tempoSpreadBpm) &&
    nearlyEqual(left.couplingStrength, right.couplingStrength) &&
    nearlyEqual(left.latencySeconds, right.latencySeconds) &&
    nearlyEqual(left.jitterSeconds, right.jitterSeconds) &&
    left.topology === right.topology &&
    left.repertoireTexture === right.repertoireTexture &&
    nearlyEqual(left.clickTrackStrength, right.clickTrackStrength)
  );
}

export function createCouplingEdges(config: EnsembleConfig): CouplingEdge[] {
  assertValidEnsembleConfig(config);
  const count = config.musicianCount;
  const edges: CouplingEdge[] = [];

  if (config.topology === "leader-follower") {
    for (let to = 1; to < count; to += 1) {
      edges.push({
        from: 0,
        to,
        strength: config.couplingStrength,
        delaySeconds: config.latencySeconds,
      });
    }
    return edges;
  }

  for (let from = 0; from < count; from += 1) {
    for (let to = 0; to < count; to += 1) {
      if (from === to) {
        continue;
      }

      const sameSection = Math.floor(from / 2) === Math.floor(to / 2);
      const sectionMultiplier =
        config.topology === "sections" ? (sameSection ? 1 : 0.35) : 1;

      edges.push({
        from,
        to,
        strength: config.couplingStrength * sectionMultiplier,
        delaySeconds: config.latencySeconds,
      });
    }
  }

  return edges;
}

export function stepEnsemble(
  state: EnsembleState,
  config: EnsembleConfig,
  edges: readonly CouplingEdge[],
  history: readonly EnsembleState[],
  dtSeconds: number,
): EnsembleState {
  assertValidEnsembleConfig(config);
  assertValidCouplingEdges(edges, state.oscillators.length);
  const profile = textureProfile(config.repertoireTexture);
  const nextOscillators = state.oscillators.map((oscillator, index) => {
    const incoming = edges.filter((edge) => edge.to === index);
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

/**
 * Advances a simulation by elapsed wall-clock time without coupling numerical
 * integration to render-frame duration. The remaining fractional interval is
 * retained for the next call.
 */
export function advanceFixedStepSimulation(
  simulation: FixedStepSimulation,
  config: EnsembleConfig,
  elapsedSeconds: number,
): FixedStepSimulation {
  assertValidEnsembleConfig(config);
  assertFiniteNonNegative("elapsedSeconds", elapsedSeconds);
  assertFiniteNonNegative("accumulatorSeconds", simulation.accumulatorSeconds);

  const edges = createCouplingEdges(config);
  const history = [...simulation.history];
  let state = simulation.state;
  let accumulatorSeconds = simulation.accumulatorSeconds + elapsedSeconds;

  while (accumulatorSeconds + FIXED_STEP_EPSILON_SECONDS >= fixedSimulationStepSeconds) {
    history.push(state);
    trimHistory(history, Math.max(1, config.latencySeconds + config.jitterSeconds + 0.5));
    state = stepEnsemble(state, config, edges, history, fixedSimulationStepSeconds);
    accumulatorSeconds -= fixedSimulationStepSeconds;
  }

  return {
    state,
    history,
    accumulatorSeconds:
      accumulatorSeconds < FIXED_STEP_EPSILON_SECONDS ? 0 : accumulatorSeconds,
  };
}

function advanceSimulationStep(input: AdvanceSimulationInput): SimulationProgress {
  const { progress, config, edges, stepSeconds, canonicalTime, sampleInterval } = input;
  progress.history.push(progress.state);
  trimHistory(
    progress.history,
    Math.max(1, config.latencySeconds + config.jitterSeconds + 0.5),
  );
  const advanced = stepEnsemble(
    progress.state,
    config,
    edges,
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
  assertFiniteNonNegative("durationSeconds", durationSeconds);
  assertFinitePositive("dtSeconds", dtSeconds);

  const edges = createCouplingEdges(config);
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
      edges,
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
      edges,
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
