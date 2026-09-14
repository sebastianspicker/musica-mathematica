// Test-only reference for the two optimizations introduced after 0d8dfe3:
// retain per-step edge filtering and the original linear history lookup.
// Shared initialization, math, and metrics are tested separately; keeping both
// implementations on the same runtime makes complete result equality portable.
import {
  createCouplingEdges,
  createInitialState,
  metricsFor,
  type EnsembleConfig,
  type EnsembleState,
  type SimulationResult,
} from "./ensemble";
import { textureProfile } from "./ensembleConfig";
import { circularDifference, normalizePhase } from "./ensembleMath";
import { clickTrackPull, effectiveDelaySeconds, feedbackReliability, trimHistory } from "./ensembleRuntime";
import type { CouplingEdge } from "./ensembleTypes";

function linearDelayedPhase(
  history: readonly EnsembleState[],
  fallback: EnsembleState,
  oscillatorIndex: number,
  targetTime: number,
): number {
  if (targetTime <= 0 || history.length === 0) {
    return fallback.oscillators[oscillatorIndex]?.phase ?? 0;
  }
  let candidate: EnsembleState | undefined;
  for (const entry of history) {
    if (entry.time > targetTime) break;
    candidate = entry;
  }
  if (!candidate) return fallback.oscillators[oscillatorIndex]?.phase ?? 0;
  const oscillator = candidate.oscillators[oscillatorIndex];
  if (!oscillator) throw new RangeError("Reference history is missing a source oscillator.");
  return oscillator.phase;
}

function stepReference(
  state: EnsembleState,
  config: EnsembleConfig,
  edges: readonly CouplingEdge[],
  history: readonly EnsembleState[],
  dt: number,
): EnsembleState {
  const profile = textureProfile(config.repertoireTexture);
  const oscillators = state.oscillators.map((oscillator, index) => {
    const incoming = edges.filter((edge) => edge.to === index);
    const peerPull = incoming.reduce((sum, edge) => {
      const delay = effectiveDelaySeconds(edge, config, state.time);
      const phase = linearDelayedPhase(history, state, edge.from, state.time - delay);
      return sum + edge.strength * profile.peerCouplingMultiplier
        * feedbackReliability(config) * Math.sin(circularDifference(oscillator.phase, phase));
    }, 0);
    const normalizedPeerPull = incoming.length === 0 ? 0 : peerPull / Math.sqrt(incoming.length);
    const clickPull = clickTrackPull(state.time, oscillator.phase, config);
    const omega = oscillator.omega + normalizedPeerPull + clickPull;
    return { phase: normalizePhase(oscillator.phase + omega * dt), omega: oscillator.omega };
  });
  return { time: state.time + dt, oscillators };
}

export function simulateEnsembleReference(config: EnsembleConfig, duration: number): SimulationResult {
  const dt = 0.01;
  const epsilon = 1e-10;
  const edges = createCouplingEdges(config);
  const history: EnsembleState[] = [];
  const samples: SimulationResult["samples"] = [];
  let state = createInitialState(config);
  let nextSampleTime = 0;

  function advance(step: number, time: number): void {
    history.push(state);
    trimHistory(history, Math.max(1, config.latencySeconds + config.jitterSeconds + 0.5));
    state = { ...stepReference(state, config, edges, history, step), time };
    if (state.time + epsilon >= nextSampleTime) {
      samples.push({ state, metrics: metricsFor(state, config) });
      while (nextSampleTime <= state.time + epsilon) nextSampleTime += 0.1;
    }
  }

  const fullStepCount = Math.floor((duration + epsilon) / dt);
  for (let index = 0; index < fullStepCount; index++) {
    advance(dt, Math.min(duration, (index + 1) * dt));
  }
  const remainder = duration - fullStepCount * dt;
  if (remainder > epsilon) advance(remainder, duration);
  return { samples, finalState: state, finalMetrics: metricsFor(state, config) };
}
