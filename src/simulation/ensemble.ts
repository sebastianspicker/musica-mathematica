const TAU = Math.PI * 2;

export type Topology = "all-to-all" | "leader-follower" | "sections" | "click-track";

export type RepertoireTexture =
  | "pulse"
  | "drone"
  | "call-response"
  | "rubato"
  | "dense-rhythm";

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

export type EnsembleConfig = {
  musicianCount: number;
  tempoBpm: number;
  tempoSpreadBpm: number;
  couplingStrength: number;
  latencySeconds: number;
  jitterSeconds: number;
  topology: Topology;
  repertoireTexture: RepertoireTexture;
  clickTrackStrength: number;
};

export type TextureProfile = {
  tempoSpreadMultiplier: number;
  peerCouplingMultiplier: number;
  clickTrackMultiplier: number;
  latencyBudgetMultiplier: number;
  jitterPenaltyMultiplier: number;
};

export type EnsembleMetrics = {
  coherence: number;
  phaseSpread: number;
  timingErrorMs: number;
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

export function normalizePhase(phase: number): number {
  const wrapped = phase % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

export function circularDifference(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function bpmToRadPerSecond(tempoBpm: number): number {
  return (tempoBpm / 60) * TAU;
}

export function textureProfile(texture: RepertoireTexture): TextureProfile {
  switch (texture) {
    case "drone":
      return {
        tempoSpreadMultiplier: 0.45,
        peerCouplingMultiplier: 0.45,
        clickTrackMultiplier: 0.25,
        latencyBudgetMultiplier: 1.8,
        jitterPenaltyMultiplier: 0.5,
      };
    case "call-response":
      return {
        tempoSpreadMultiplier: 0.75,
        peerCouplingMultiplier: 0.7,
        clickTrackMultiplier: 0.6,
        latencyBudgetMultiplier: 1.35,
        jitterPenaltyMultiplier: 0.7,
      };
    case "rubato":
      return {
        tempoSpreadMultiplier: 0.55,
        peerCouplingMultiplier: 0.65,
        clickTrackMultiplier: 0.25,
        latencyBudgetMultiplier: 1.45,
        jitterPenaltyMultiplier: 0.8,
      };
    case "dense-rhythm":
      return {
        tempoSpreadMultiplier: 1.25,
        peerCouplingMultiplier: 1.2,
        clickTrackMultiplier: 1.25,
        latencyBudgetMultiplier: 0.62,
        jitterPenaltyMultiplier: 1.7,
      };
    case "pulse":
      return {
        tempoSpreadMultiplier: 1,
        peerCouplingMultiplier: 1,
        clickTrackMultiplier: 1,
        latencyBudgetMultiplier: 1,
        jitterPenaltyMultiplier: 1,
      };
  }
}

export function coherence(oscillators: readonly Oscillator[]): number {
  if (oscillators.length === 0) {
    return 0;
  }

  const sum = oscillators.reduce(
    (acc, oscillator) => ({
      x: acc.x + Math.cos(oscillator.phase),
      y: acc.y + Math.sin(oscillator.phase),
    }),
    { x: 0, y: 0 },
  );

  return Math.hypot(sum.x, sum.y) / oscillators.length;
}

export function meanPhase(oscillators: readonly Oscillator[]): number {
  if (oscillators.length === 0) {
    return 0;
  }

  const sum = oscillators.reduce(
    (acc, oscillator) => ({
      x: acc.x + Math.cos(oscillator.phase),
      y: acc.y + Math.sin(oscillator.phase),
    }),
    { x: 0, y: 0 },
  );

  return normalizePhase(Math.atan2(sum.y, sum.x));
}

export function phaseSpread(oscillators: readonly Oscillator[]): number {
  const center = meanPhase(oscillators);
  const squaredError = oscillators.reduce((sum, oscillator) => {
    const error = circularDifference(center, oscillator.phase);
    return sum + error * error;
  }, 0);

  return Math.sqrt(squaredError / Math.max(oscillators.length, 1));
}

export function idealizedPhaseBudgetSeconds(tempoBpm: number): number {
  return Math.PI / (2 * bpmToRadPerSecond(tempoBpm));
}

export function modelLatencyBudgetSeconds(config: EnsembleConfig): number {
  return idealizedPhaseBudgetSeconds(config.tempoBpm) *
    textureProfile(config.repertoireTexture).latencyBudgetMultiplier;
}

export function modelLatencyBudgetRatio(
  config: EnsembleConfig,
  metrics: Pick<EnsembleMetrics, "modelLatencyBudgetSeconds">,
): number {
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
  const peer = Math.max(0, config.couplingStrength);
  const click = Math.max(0, config.clickTrackStrength);
  if (peer + click === 0) {
    return 0;
  }

  return peer / (peer + click);
}

export function timingErrorMs(state: EnsembleState): number {
  const averageOmega =
    state.oscillators.reduce((sum, oscillator) => sum + oscillator.omega, 0) /
    Math.max(state.oscillators.length, 1);
  const spread = phaseSpread(state.oscillators);
  return (spread / Math.max(averageOmega, 0.001)) * 1000;
}

export function metricsFor(state: EnsembleState, config: EnsembleConfig): EnsembleMetrics {
  return {
    coherence: coherence(state.oscillators),
    phaseSpread: phaseSpread(state.oscillators),
    timingErrorMs: timingErrorMs(state),
    peerCouplingShare: peerCouplingShare(config),
    modelLatencyBudgetSeconds: modelLatencyBudgetSeconds(config),
  };
}

export function createInitialState(config: EnsembleConfig): EnsembleState {
  const count = Math.max(1, config.musicianCount);

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

export function naturalOmegaFor(index: number, count: number, config: EnsembleConfig): number {
  const centered = count <= 1 ? 0 : (index / (count - 1) - 0.5) * 2;
  const profile = textureProfile(config.repertoireTexture);
  const spreadOmega = bpmToRadPerSecond(config.tempoSpreadBpm * profile.tempoSpreadMultiplier);
  return bpmToRadPerSecond(config.tempoBpm) + centered * spreadOmega;
}

export function retuneState(state: EnsembleState, config: EnsembleConfig): EnsembleState {
  const count = Math.max(1, config.musicianCount);
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
  const count = Math.max(1, config.musicianCount);
  const edges: CouplingEdge[] = [];

  if (config.topology === "click-track") {
    return edges;
  }

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
  const profile = textureProfile(config.repertoireTexture);
  const effectiveEdges = edges.filter((edge) => edge.to < state.oscillators.length);
  const nextOscillators = state.oscillators.map((oscillator, index) => {
    const incoming = effectiveEdges.filter((edge) => edge.to === index);
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

export function simulateEnsemble(
  config: EnsembleConfig,
  durationSeconds: number,
  dtSeconds = 0.01,
): SimulationResult {
  assertFiniteNonNegative("durationSeconds", durationSeconds);
  assertFinitePositive("dtSeconds", dtSeconds);

  const edges = createCouplingEdges(config);
  const samples: SimulationSample[] = [];
  const history: EnsembleState[] = [];
  let state = createInitialState(config);
  const sampleInterval = 0.1;
  let nextSampleTime = 0;

  while (state.time < durationSeconds) {
    history.push(state);
    trimHistory(history, Math.max(1, config.latencySeconds + config.jitterSeconds + 0.5));
    state = stepEnsemble(state, config, edges, history, dtSeconds);

    if (state.time >= nextSampleTime) {
      samples.push({
        state,
        metrics: metricsFor(state, config),
      });
      nextSampleTime += sampleInterval;
    }
  }

  return {
    samples,
    finalState: state,
    finalMetrics: metricsFor(state, config),
  };
}

function delayedOscillatorPhase(
  history: readonly EnsembleState[],
  fallback: EnsembleState,
  oscillatorIndex: number,
  targetTime: number,
): number {
  if (targetTime <= 0 || history.length === 0) {
    return fallback.oscillators[oscillatorIndex]?.phase ?? 0;
  }

  let candidate = history[0] ?? fallback;
  for (const entry of history) {
    if (entry.time > targetTime) {
      break;
    }
    candidate = entry;
  }

  return candidate.oscillators[oscillatorIndex]?.phase ?? fallback.oscillators[0]?.phase ?? 0;
}

function clickTrackPull(time: number, phase: number, config: EnsembleConfig): number {
  if (config.clickTrackStrength <= 0) {
    return 0;
  }

  const profile = textureProfile(config.repertoireTexture);
  const clickPhase = normalizePhase(bpmToRadPerSecond(config.tempoBpm) * time);
  return (
    config.clickTrackStrength *
    profile.clickTrackMultiplier *
    Math.sin(circularDifference(phase, clickPhase))
  );
}

function effectiveDelaySeconds(
  edge: CouplingEdge,
  config: EnsembleConfig,
  time: number,
): number {
  if (config.jitterSeconds <= 0) {
    return edge.delaySeconds;
  }

  const frameSeconds = 0.025;
  const frame = Math.floor(time / frameSeconds);
  const blend = time / frameSeconds - frame;
  const previous = deterministicNoise(edge.from, edge.to, frame);
  const next = deterministicNoise(edge.from, edge.to, frame + 1);
  const smoothBlend = blend * blend * (3 - 2 * blend);
  const jitter = previous + (next - previous) * smoothBlend;
  return Math.max(0, edge.delaySeconds + jitter * config.jitterSeconds);
}

function feedbackReliability(config: EnsembleConfig): number {
  if (config.jitterSeconds <= 0) {
    return 1;
  }

  const profile = textureProfile(config.repertoireTexture);
  const jitterRatio = config.jitterSeconds / Math.max(config.latencySeconds, 0.01);
  return Math.max(0.08, 1 - jitterRatio * 1.35 * profile.jitterPenaltyMultiplier);
}

function trimHistory(history: EnsembleState[], keepSeconds: number): void {
  const latest = history[history.length - 1];
  if (!latest) {
    return;
  }

  const cutoff = latest.time - keepSeconds;
  while (history.length > 2 && history[0]?.time !== undefined && history[0].time < cutoff) {
    history.shift();
  }
}

function assertFiniteNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }
}

function assertFinitePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number.`);
  }
}

function deterministicNoise(from: number, to: number, frame: number): number {
  const seed = (from + 1) * 12.9898 + (to + 1) * 78.233 + (frame + 1) * 37.719;
  const sine = Math.sin(seed) * 43758.5453;
  return (sine - Math.floor(sine)) * 2 - 1;
}

function initialPhaseFor(index: number, count: number): number {
  const imperfectCircle = (TAU * index) / count + 0.41 * Math.sin((index + 1) * 1.73);
  return normalizePhase(imperfectCircle);
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 1e-9;
}
