import { analyzeRhythm, euclideanRhythm, rankMeterCandidates, rotateRhythm } from "./model";
import {
  axes,
  readNumber,
  observable,
  result,
  readString,
  SYNTHETIC_PROVENANCE,
} from "../support/evaluation";
import type { EvaluationOutput, FactorValue } from "../../curriculum/contracts";

type Factors = Readonly<Record<string, FactorValue>>;

function safePattern(factors: Factors): number[] {
  const steps = Math.max(1, Math.round(readNumber(factors, "steps")));
  const pulses = Math.min(steps, Math.max(0, Math.round(readNumber(factors, "pulses"))));
  const rotation = Math.round(readNumber(factors, "rotation"));
  return rotateRhythm(euclideanRhythm(pulses, steps), rotation);
}

export function evaluateCyclesAndEuclideanRhythm(factors: Factors): EvaluationOutput {
  const pattern = safePattern(factors);
  const analysis = analyzeRhythm(pattern);
  const trace = pattern.map((value, index) => ({ x: index, y: value, series: "Onset pattern" }));
  return result({
    headline: "Cyclic onset vector",
    result: pattern.join(" "),
    observables: [
      observable({ id: "onsets", label: "Onset count", value: analysis.pulseCount, unit: null, claimId: "math.identity", precision: 0 }),
      observable({ id: "density", label: "Onset density", value: analysis.density, unit: null, claimId: "math.identity", precision: 3 }),
      observable({ id: "cycleLength", label: "Cycle length", value: pattern.length, unit: "steps", claimId: "math.identity", precision: 0 }),
    ],
    trace,
    visualKind: "pulse",
    annotation: "Rotation preserves onset count and density while relocating the chosen cycle origin.",
    traceAxes: axes("Cycle step", "steps", "Onset indicator", null),
  });
}

export function evaluateAutocorrelationSpectrumMeter(factors: Factors): EvaluationOutput {
  const pattern = safePattern(factors);
  const analysis = analyzeRhythm(pattern);
  const meters = rankMeterCandidates(pattern);
  let strongestSpectrum: (typeof analysis.spectrum)[number] | undefined;
  // Mirror bins k and N-k tie, so only the lower half is searched and the lowest bin wins ties.
  for (const entry of analysis.spectrum.slice(1, Math.floor(pattern.length / 2) + 1)) {
    if (!strongestSpectrum || entry.magnitude > strongestSpectrum.magnitude + 1e-9) strongestSpectrum = entry;
  }
  const topMeter = meters[0];
  // A flat spectrum (e.g. all-ones) has no non-DC peak; report bin 0 for "none".
  const spectralBin = strongestSpectrum && strongestSpectrum.magnitude >= 1e-9 ? strongestSpectrum.bin : 0;
  const profileTrace = analysis.autocorrelation.map((value, index) => ({
    x: index,
    y: value,
    series: "Circular autocorrelation",
  }));
  return result({
    headline: "Ranked periodicity",
    result: topMeter ? `${topMeter.beats} beats × ${topMeter.subdivisionsPerBeat} subdivisions` : "No meter candidate (needs 2+ steps per beat)",
    observables: [
      observable({ id: "topMeter", label: "Top equal-subdivision candidate", value: topMeter ? `${topMeter.beats} × ${topMeter.subdivisionsPerBeat}` : "none", unit: null, claimId: "heuristic.transparent" }),
      observable({ id: "meterScore", label: "Chance-corrected alignment score", value: topMeter?.score ?? 0, unit: null, claimId: "heuristic.transparent", precision: 3 }),
      observable({ id: "spectralBin", label: "Strongest non-DC bin (0 = none)", value: spectralBin, unit: null, claimId: "model.deterministic", precision: 0 }),
    ],
    trace: profileTrace,
    visualKind: "spectrum",
    annotation: "The ranking describes this vector under one candidate family; it is not a definitive heard meter.",
    traceAxes: axes("Circular lag", "steps", "Autocorrelation", null),
  });
}

export function evaluateRecordedOnsetHypotheses(factors: Factors): EvaluationOutput {
  const tempo = readNumber(factors, "tempoBpm");
  const threshold = readNumber(factors, "threshold");
  const bias = readString(factors, "meterBias");
  const strengths = Array.from({ length: 12 }, (_, index) => ({ x: index * (60 / tempo), y: 0.65 + 0.25 * Math.sin(index * 1.7) }));
  const kept = strengths.filter((point) => point.y >= threshold);
  const eventCount = kept.length;
  const candidates = bias === "duple" ? [tempo, tempo / 2, tempo * 2] : bias === "triple" ? [tempo, tempo * 1.5, tempo / 2] : [tempo, tempo / 2, tempo * 1.5];
  const trace = [
    ...strengths.map((point) => ({ ...point, series: "Candidate onset strength" })),
    ...kept.map((point) => ({ ...point, series: "Above threshold" })),
  ];
  return result({
    headline: "Synthetic tempo candidates (order set by construction)",
    result: `${candidates[0].toFixed(1)} BPM (input tempo)`,
    observables: [
      observable({ id: "onsetCount", label: "Events above threshold", value: eventCount, unit: null, claimId: "hypothesis.transcription", precision: 0 }),
      observable({ id: "tempo1", label: "Tempo candidate 1", value: candidates[0], unit: "BPM", claimId: "hypothesis.transcription", precision: 1 }),
      observable({ id: "tempo2", label: "Tempo candidate 2", value: candidates[1], unit: "BPM", claimId: "hypothesis.transcription", precision: 1 }),
      observable({ id: "tempo3", label: "Tempo candidate 3", value: candidates[2], unit: "BPM", claimId: "hypothesis.transcription", precision: 1 }),
    ],
    trace,
    visualKind: "spectrum",
    annotation: "Synthetic fixture shown; candidates are listed with the input tempo first, so the order is not a ranking. Microphone and file modes must retain the same hypothesis wording and local-only boundary.",
    traceAxes: axes("Time", "s", "Onset strength", null),
    provenance: SYNTHETIC_PROVENANCE,
  });
}
