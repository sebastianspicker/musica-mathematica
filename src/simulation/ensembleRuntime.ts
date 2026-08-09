import { textureProfile } from "./ensembleConfig";
import type { EnsembleConfig } from "./ensembleConfig";
import type { CouplingEdge, EnsembleState } from "./ensemble";
import { bpmToRadPerSecond, circularDifference, normalizePhase } from "./ensembleMath";

export function delayedOscillatorPhase(
  history: readonly EnsembleState[],
  fallback: EnsembleState,
  oscillatorIndex: number,
  targetTime: number,
): number {
  if (targetTime <= 0 || history.length === 0) {
    return oscillatorPhaseOrZero(fallback, oscillatorIndex);
  }

  let candidate: EnsembleState | undefined;
  for (const entry of history) {
    if (entry.time > targetTime) break;
    candidate = entry;
  }

  if (!candidate) return oscillatorPhaseOrZero(fallback, oscillatorIndex);
  const oscillator = candidate.oscillators.at(oscillatorIndex);
  if (!oscillator) {
    throw new RangeError("delayed coupling history is missing the requested source oscillator.");
  }
  return oscillator.phase;
}

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

export function feedbackReliability(config: EnsembleConfig): number {
  if (config.jitterSeconds <= 0) return 1;
  const profile = textureProfile(config.repertoireTexture);
  const jitterRatio = config.jitterSeconds / Math.max(config.latencySeconds, 0.01);
  return Math.max(0.08, 1 - jitterRatio * 1.35 * profile.jitterPenaltyMultiplier);
}

export function clickTrackPull(time: number, phase: number, config: EnsembleConfig): number {
  if (config.clickTrackStrength <= 0) return 0;
  const profile = textureProfile(config.repertoireTexture);
  const clickPhase = normalizePhase(bpmToRadPerSecond(config.tempoBpm) * time);
  return config.clickTrackStrength
    * profile.clickTrackMultiplier
    * Math.sin(circularDifference(phase, clickPhase));
}

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
