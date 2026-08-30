import { analyzeRhythm, euclideanRhythm, rankMeterCandidates, rotateRhythm } from "./model";
import {
  axes,
  numberFactor,
  observableValues as observable,
  resultValues as result,
  stringFactor,
  SYNTHETIC_PROVENANCE,
} from "../support/evaluation";
import type { EvaluationOutput, FactorValue } from "../../curriculum/contracts";

type Factors = Readonly<Record<string, FactorValue>>;

function safePattern(factors: Factors): number[] {
  const steps = Math.max(1, Math.round(numberFactor(factors, "steps")));
  const pulses = Math.min(steps, Math.max(0, Math.round(numberFactor(factors, "pulses"))));
  const rotation = Math.round(numberFactor(factors, "rotation"));
  return rotateRhythm(euclideanRhythm(pulses, steps), rotation);
}

export function evaluateCyclesAndEuclideanRhythm(factors: Factors): EvaluationOutput {
  const pattern = safePattern(factors);
  const analysis = analyzeRhythm(pattern);
  const trace = pattern.map((value, index) => ({ x: index, y: value, series: "Onset pattern" }));
  return result(
    "Cyclic onset vector",
    pattern.join(" "),
    [
      observable("onsets", "Onset count", analysis.pulseCount, null, "math.identity", 0),
      observable("density", "Onset density", analysis.density, null, "math.identity", 3),
      observable("cycleLength", "Cycle length", pattern.length, "steps", "math.identity", 0),
    ],
    trace,
    "pulse",
    "Rotation preserves onset count and density while relocating the chosen cycle origin.",
    axes("Cycle step", "steps", "Onset indicator", null),
  );
}

export function evaluateAutocorrelationSpectrumMeter(factors: Factors): EvaluationOutput {
  const pattern = safePattern(factors);
  const analysis = analyzeRhythm(pattern);
  const meters = rankMeterCandidates(pattern);
  const strongestSpectrum = analysis.spectrum.slice(1).sort((a, b) => b.magnitude - a.magnitude)[0];
  const topMeter = meters[0];
  const profileTrace = analysis.autocorrelation.map((value, index) => ({
    x: index,
    y: value,
    series: "Circular autocorrelation",
  }));
  return result(
    "Ranked periodicity",
    topMeter ? `${topMeter.beats} beats × ${topMeter.subdivisionsPerBeat} subdivisions` : "No equal-subdivision candidate",
    [
      observable("topMeter", "Top equal-subdivision candidate", topMeter ? `${topMeter.beats} × ${topMeter.subdivisionsPerBeat}` : "none", null, "heuristic.transparent"),
      observable("meterScore", "Onset-alignment score", topMeter?.score ?? 0, null, "heuristic.transparent", 3),
      observable("spectralBin", "Strongest non-DC bin", strongestSpectrum?.bin ?? 0, null, "model.deterministic", 0),
    ],
    profileTrace,
    "spectrum",
    "The ranking describes this vector under one candidate family; it is not a definitive heard meter.",
    axes("Circular lag", "steps", "Autocorrelation", null),
  );
}

export function evaluateRecordedOnsetHypotheses(factors: Factors): EvaluationOutput {
  const tempo = numberFactor(factors, "tempoBpm");
  const threshold = numberFactor(factors, "threshold");
  const bias = stringFactor(factors, "meterBias");
  const eventCount = Math.max(2, Math.round(12 * (1.05 - threshold)));
  const candidates = bias === "duple" ? [tempo, tempo / 2, tempo * 2] : bias === "triple" ? [tempo, tempo * 1.5, tempo / 2] : [tempo, tempo / 2, tempo * 1.5];
  const trace = Array.from({ length: eventCount }, (_, index) => ({
    x: index * (60 / tempo),
    y: 0.65 + 0.25 * Math.sin(index * 1.7),
    series: "Detected onset strength",
  }));
  return result(
    "Ranked transcription hypotheses",
    `${candidates[0].toFixed(1)} BPM (top candidate)`,
    [
      observable("onsetCount", "Events above threshold", eventCount, null, "hypothesis.transcription", 0),
      observable("tempo1", "Tempo candidate 1", candidates[0], "BPM", "hypothesis.transcription", 1),
      observable("tempo2", "Tempo candidate 2", candidates[1], "BPM", "hypothesis.transcription", 1),
      observable("tempo3", "Tempo candidate 3", candidates[2], "BPM", "hypothesis.transcription", 1),
    ],
    trace,
    "spectrum",
    "Synthetic fixture shown. Microphone and file modes must retain the same hypothesis wording and local-only boundary.",
    axes("Time", "s", "Onset strength", null),
    SYNTHETIC_PROVENANCE,
  );
}
