import {
  describeEventAlignment,
  deterministicCenteredSample,
  recoverTempoFromOnsets,
  summarizeDistribution,
  syntheticOnsets,
} from "../measurement-inference";
import {
  axes,
  numberFactor,
  observable,
  result,
  signed,
  SYNTHETIC_PROVENANCE,
} from "../evaluationSupport";
import type { FactorValue, LabEvaluation } from "../types";

export function evaluateUncertainty(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
  const count = Math.round(numberFactor(factors, "sampleCount"));
  const trueValue = numberFactor(factors, "trueValue");
  const noise = numberFactor(factors, "noise");
  const seed = Math.round(numberFactor(factors, "seed"));
  const values = deterministicCenteredSample(trueValue, noise, count, seed);
  const summary = summarizeDistribution(values);
  const center = summary.mean;
  const standardError = summary.standardDeviation / Math.sqrt(count);
  const [lower, upper] = summary.approximate95Interval;
  const halfWidth = (upper - lower) / 2;
  return result({
    headline: "Synthetic uncertainty summary",
    result: `${center.toFixed(2)} ± ${halfWidth.toFixed(2)} units`,
    observables: [
      observable({ id: "mean", label: "Sample mean", value: center, unit: "units", claimId: "model.deterministic", precision: 2, aggregation: "distribution" }),
      observable({ id: "standardError", label: "Estimated standard error", value: standardError, unit: "units", claimId: "heuristic.transparent", precision: 2, aggregation: "distribution" }),
      observable({ id: "interval", label: "Approximate 95% interval", value: `${lower.toFixed(2)}–${upper.toFixed(2)}`, unit: "units", claimId: "heuristic.transparent" }),
    ],
    trace: values.map((value, index) => ({ x: index + 1, y: value, series: "Synthetic observations" })),
    visualKind: "measurement",
    annotation: "The interval is a teaching approximation whose assumptions must accompany any inference.",
    traceAxes: axes("Observation index", "observations", "Synthetic value", "units"),
    provenance: SYNTHETIC_PROVENANCE,
  });
}

export function evaluateParameterRecovery(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
  const tempo = numberFactor(factors, "tempoBpm");
  const jitterMs = numberFactor(factors, "jitterMs");
  const count = Math.round(numberFactor(factors, "sampleCount"));
  const seed = Math.round(numberFactor(factors, "seed"));
  const onsets = syntheticOnsets(tempo, jitterMs / 1000, count, seed);
  const recovery = recoverTempoFromOnsets(onsets);
  const intervals = recovery.intervalsSeconds;
  const recovered = recovery.estimatedBpm;
  const iqr = recovery.intervalIqrSeconds;
  return result({
    headline: "Synthetic parameter recovery",
    result: `${recovered.toFixed(2)} BPM from ${tempo.toFixed(1)} BPM generator`,
    observables: [
      observable({ id: "recovered", label: "Recovered tempo hypothesis", value: recovered, unit: "BPM", claimId: "hypothesis.transcription", precision: 2, aggregation: "distribution" }),
      observable({ id: "error", label: "Recovery error", value: recovered - tempo, unit: "BPM", claimId: "model.deterministic", precision: 2 }),
      observable({ id: "intervalIqr", label: "Inter-onset IQR", value: iqr * 1000, unit: "ms", claimId: "model.deterministic", precision: 1, aggregation: "distribution" }),
    ],
    trace: intervals.map((value, index) => ({ x: index + 1, y: value * 1000, series: "Inter-onset intervals" })),
    visualKind: "measurement",
    annotation: "Known synthetic truth makes error visible; real sound adds subdivisions, missing events, and tempo change.",
    traceAxes: axes("Interval index", "intervals", "Inter-onset interval", "ms"),
    provenance: SYNTHETIC_PROVENANCE,
  });
}

export function evaluateDescriptiveComparison(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
  const offset = numberFactor(factors, "offsetMs");
  const spread = numberFactor(factors, "spreadMs");
  const count = Math.round(numberFactor(factors, "eventCount"));
  const seed = Math.round(numberFactor(factors, "seed"));
  const differences = deterministicCenteredSample(offset, spread, count, seed);
  const reference = Array<number>(count).fill(0);
  const summary = describeEventAlignment(differences, reference, { unit: "ms", centeredTolerance: 1 });
  const median = summary.medianDifference;
  const lower = summary.firstQuartile;
  const upper = summary.thirdQuartile;
  const direction = summary.direction === "centered"
    ? "centered near the reference"
    : summary.direction === "observed-later" ? "later than the reference" : "earlier than the reference";
  return result({
    headline: "Descriptive event alignment",
    result: `Median ${signed(median, 1)} ms; IQR ${lower.toFixed(1)} to ${upper.toFixed(1)} ms`,
    observables: [
      observable({ id: "median", label: "Median signed difference", value: median, unit: "ms", claimId: "measurement.local", precision: 1, aggregation: "distribution" }),
      observable({ id: "iqr", label: "Interquartile range", value: upper - lower, unit: "ms", claimId: "measurement.local", precision: 1, aggregation: "distribution" }),
      observable({ id: "direction", label: "Neutral description", value: direction, unit: null, claimId: "measurement.local" }),
    ],
    trace: differences.map((value, index) => ({ x: index + 1, y: value, series: "Signed event differences" })),
    visualKind: "measurement",
    annotation: "Difference is described by direction and spread; the protocol defines no target, score, or grade.",
    traceAxes: axes("Event index", "events", "Signed event difference", "ms"),
    provenance: SYNTHETIC_PROVENANCE,
  });
}
