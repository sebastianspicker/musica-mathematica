import {
  aliasFrequencyHz,
  fourierResolution,
  idealStringModes,
  timeVaryingTimbreTrajectory,
} from "../timbre-acoustics";
import {
  axes,
  numberFactor,
  observable,
  result,
  stringFactor,
  SYNTHETIC_PROVENANCE,
} from "../evaluationSupport";
import type { FactorValue, LabEvaluation } from "../types";

export function evaluateResonance(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
  const length = numberFactor(factors, "length");
  const waveSpeed = numberFactor(factors, "waveSpeed");
  const partialCount = Math.round(numberFactor(factors, "partialCount"));
  const modes = idealStringModes(length, waveSpeed, partialCount);
  const fundamental = modes[0].frequencyHz;
  const trace = modes.map((mode) => ({ x: mode.frequencyHz, y: 1 / mode.modeNumber, series: "Ideal modes" }));
  return result({
    headline: "Ideal fixed-string modes",
    result: `f1 = ${fundamental.toFixed(2)} Hz`,
    observables: [
      observable({ id: "fundamental", label: "Fundamental mode", value: fundamental, unit: "Hz", claimId: "math.identity", precision: 2 }),
      observable({ id: "highestMode", label: "Highest displayed mode", value: modes.at(-1)?.frequencyHz ?? fundamental, unit: "Hz", claimId: "math.identity", precision: 2 }),
      observable({ id: "modeCount", label: "Mode count", value: partialCount, unit: null, claimId: "math.identity", precision: 0 }),
    ],
    trace,
    visualKind: "spectrum",
    annotation: "The ideal series excludes stiffness, damping, body radiation, room response, and measured calibration.",
    traceAxes: axes("Mode frequency", "Hz", "Relative amplitude", null),
  });
}

export function evaluateAliasing(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
  const frequency = numberFactor(factors, "frequencyHz");
  const sampleRate = Number(stringFactor(factors, "sampleRateHz"));
  const frameSize = Number(stringFactor(factors, "frameSize"));
  const resolution = fourierResolution(sampleRate, frameSize);
  const alias = aliasFrequencyHz(frequency, sampleRate);
  const hann = Array.from({ length: 48 }, (_, index) => ({
    x: index,
    y: 0.5 * (1 - Math.cos((2 * Math.PI * index) / 47)),
    series: "Hann window",
  }));
  return result({
    headline: "Sampled-frame limits",
    result: `${resolution.binWidthHz.toFixed(2)} Hz/bin; ${alias.toFixed(1)} Hz represented`,
    observables: [
      observable({ id: "binSpacing", label: "Frequency-bin spacing", value: resolution.binWidthHz, unit: "Hz", claimId: "math.identity", precision: 2 }),
      observable({ id: "nyquist", label: "Nyquist frequency", value: resolution.nyquistHz, unit: "Hz", claimId: "math.identity", precision: 0 }),
      observable({ id: "alias", label: "Represented alias frequency", value: alias, unit: "Hz", claimId: "math.identity", precision: 1 }),
      observable({ id: "frameDuration", label: "Frame duration", value: resolution.frameDurationSeconds * 1000, unit: "ms", claimId: "math.identity", precision: 1 }),
    ],
    trace: hann,
    visualKind: "spectrum",
    annotation: "Hann windowing reduces edge discontinuity but trades peak width; bins are not infinitely precise frequencies.",
    traceAxes: axes("Sample index", "samples", "Window amplitude", null),
  });
}

export function evaluateTimeVaryingTimbre(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
  const attack = numberFactor(factors, "attackMs") / 1000;
  const decay = numberFactor(factors, "decayMs") / 1000;
  const modulation = numberFactor(factors, "modulationHz");
  const depth = numberFactor(factors, "modulationDepth");
  const duration = attack + decay;
  const trajectory = timeVaryingTimbreTrajectory({
    fundamentalHz: 150,
    partialCount: 12,
    durationSeconds: duration,
    pointCount: 96,
    attackSeconds: attack,
    decaySeconds: decay,
    brightnessModulationHz: modulation,
    brightnessModulationDepth: depth,
  });
  const trace = trajectory.map((point) => ({ x: point.timeSeconds, y: point.spectralCentroidHz, series: "Spectral-centroid proxy" }));
  const values = trace.map((point) => point.y);
  return result({
    headline: "Time-indexed timbre proxy",
    result: `${Math.min(...values).toFixed(0)}–${Math.max(...values).toFixed(0)} Hz`,
    observables: [
      observable({ id: "centroidRange", label: "Centroid-proxy range", value: `${Math.min(...values).toFixed(0)}–${Math.max(...values).toFixed(0)}`, unit: "Hz", claimId: "heuristic.transparent" }),
      observable({ id: "duration", label: "Synthetic duration", value: duration, unit: "s", claimId: "model.deterministic", precision: 2 }),
      observable({ id: "peakTime", label: "Envelope peak", value: attack, unit: "s", claimId: "model.deterministic", precision: 3 }),
    ],
    trace,
    visualKind: "spectrum",
    annotation: "A trajectory preserves change through time; it remains a synthetic, uncalibrated proxy for timbre.",
    traceAxes: axes("Time", "s", "Spectral-centroid proxy", "Hz"),
    provenance: SYNTHETIC_PROVENANCE,
  });
}
