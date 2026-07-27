import { assertNonEmptyFiniteNumbers } from "../../numericValidation";

export type DistributionSummary = Readonly<{
  count: number;
  mean: number;
  median: number;
  standardDeviation: number;
  firstQuartile: number;
  thirdQuartile: number;
  interquartileRange: number;
  approximate95Interval: readonly [number, number];
}>;

export type AlignmentDescription = Readonly<{
  pairedEventCount: number;
  signedDifferences: readonly number[];
  medianDifference: number;
  firstQuartile: number;
  thirdQuartile: number;
  interquartileRange: number;
  direction: "observed-earlier" | "centered" | "observed-later";
  unit: string;
  calibration: "uncalibrated";
  interpretation: string;
}>;

type AlignmentDirection = AlignmentDescription["direction"];

export type TempoRecovery = Readonly<{
  onsetCount: number;
  intervalsSeconds: readonly number[];
  medianIntervalSeconds: number;
  intervalIqrSeconds: number;
  estimatedBpm: number;
  label: "tempo hypothesis";
}>;

/** Linear-interpolated sample quantile (the common type-7 definition). */
export function quantile(values: readonly number[], probability: number): number {
  assertNonEmptyFiniteNumbers(values, "values");
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new RangeError("probability must be between zero and one");
  }
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return sorted[lower] + fraction * (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]);
}

export function median(values: readonly number[]): number {
  return quantile(values, 0.5);
}

export function summarizeDistribution(values: readonly number[]): DistributionSummary {
  assertNonEmptyFiniteNumbers(values, "values");
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.length > 1
    ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
    : 0;
  const standardDeviation = Math.sqrt(variance);
  const margin = 1.96 * standardDeviation / Math.sqrt(values.length);
  const firstQuartile = quantile(values, 0.25);
  const thirdQuartile = quantile(values, 0.75);
  return Object.freeze({
    count: values.length,
    mean,
    median: median(values),
    standardDeviation,
    firstQuartile,
    thirdQuartile,
    interquartileRange: thirdQuartile - firstQuartile,
    approximate95Interval: Object.freeze([mean - margin, mean + margin] as const),
  });
}

function assertPairedEventCounts(
  observedEvents: readonly number[],
  referenceEvents: readonly number[],
): void {
  if (observedEvents.length !== referenceEvents.length) {
    throw new RangeError("observedEvents and referenceEvents must contain the same number of paired events");
  }
}

function centeredToleranceFor(
  options: Readonly<{ unit?: string; centeredTolerance?: number }>,
): number {
  const tolerance = options.centeredTolerance ?? 1e-9;
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new RangeError("centeredTolerance must be non-negative and finite");
  }
  return tolerance;
}

function alignmentDirection(medianDifference: number, centeredTolerance: number): AlignmentDirection {
  if (Math.abs(medianDifference) <= centeredTolerance) return "centered";
  if (medianDifference < 0) return "observed-earlier";
  return "observed-later";
}

function alignmentRelation(direction: AlignmentDirection, medianDifference: number): string {
  if (direction === "centered") {
    return `have a centered median signed difference of ${medianDifference}`;
  }
  const relativeTiming = direction === "observed-earlier" ? "earlier" : "later";
  return `occur ${relativeTiming} by ${Math.abs(medianDifference)}`;
}

/**
 * Summarizes paired signed differences. It deliberately exposes no score,
 * grade, accuracy class, or better/worse label.
 */
export function describeEventAlignment(
  observedEvents: readonly number[],
  referenceEvents: readonly number[],
  options: Readonly<{ unit?: string; centeredTolerance?: number }> = {},
): AlignmentDescription {
  assertNonEmptyFiniteNumbers(observedEvents, "observedEvents");
  assertNonEmptyFiniteNumbers(referenceEvents, "referenceEvents");
  assertPairedEventCounts(observedEvents, referenceEvents);
  const centeredTolerance = centeredToleranceFor(options);
  const signedDifferences = observedEvents.map((observed, index) => observed - referenceEvents[index]);
  const summary = summarizeDistribution(signedDifferences);
  const direction = alignmentDirection(summary.median, centeredTolerance);
  const unit = options.unit ?? "seconds";
  const relation = alignmentRelation(direction, summary.median);
  return Object.freeze({
    pairedEventCount: signedDifferences.length,
    signedDifferences: Object.freeze(signedDifferences),
    medianDifference: summary.median,
    firstQuartile: summary.firstQuartile,
    thirdQuartile: summary.thirdQuartile,
    interquartileRange: summary.interquartileRange,
    direction,
    unit,
    calibration: "uncalibrated",
    interpretation: `The selected events ${relation} ${unit}; the middle 50% spans ${summary.interquartileRange} ${unit}.`,
  });
}

/** Median inter-onset-interval estimator; results remain tempo hypotheses. */
export function recoverTempoFromOnsets(onsetsSeconds: readonly number[]): TempoRecovery {
  assertNonEmptyFiniteNumbers(onsetsSeconds, "onsetsSeconds");
  if (onsetsSeconds.length < 2) throw new RangeError("at least two onsets are required");
  const intervalsSeconds = onsetsSeconds.slice(1).map((onset, index) => onset - onsetsSeconds[index]);
  if (intervalsSeconds.some((interval) => interval <= 0)) {
    throw new RangeError("onsetsSeconds must be strictly increasing");
  }
  const medianIntervalSeconds = median(intervalsSeconds);
  const firstQuartile = quantile(intervalsSeconds, 0.25);
  const thirdQuartile = quantile(intervalsSeconds, 0.75);
  return Object.freeze({
    onsetCount: onsetsSeconds.length,
    intervalsSeconds: Object.freeze(intervalsSeconds),
    medianIntervalSeconds,
    intervalIqrSeconds: thirdQuartile - firstQuartile,
    estimatedBpm: 60 / medianIntervalSeconds,
    label: "tempo hypothesis" as const,
  });
}

/** Signed estimator bias for a synthetic fixture with a known generating value. */
export function parameterRecoveryError(estimatedValue: number, generatingValue: number): number {
  if (!Number.isFinite(estimatedValue) || !Number.isFinite(generatingValue)) {
    throw new RangeError("estimatedValue and generatingValue must be finite");
  }
  return estimatedValue - generatingValue;
}

/** Reproducible centered uniform fixture for teaching uncertainty, never hidden randomness. */
export function deterministicCenteredSample(
  center: number,
  halfWidth: number,
  count: number,
  seed: number,
): number[] {
  if (!Number.isFinite(center)) throw new RangeError("center must be finite");
  if (!Number.isFinite(halfWidth) || halfWidth < 0) throw new RangeError("halfWidth must be non-negative and finite");
  if (!Number.isSafeInteger(count) || count <= 0) throw new RangeError("count must be a positive safe integer");
  if (!Number.isSafeInteger(seed)) throw new RangeError("seed must be a safe integer");
  let state = seed >>> 0;
  return Array.from({ length: count }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return center + (state / 4294967296 * 2 - 1) * halfWidth;
  });
}

/** Reproducible onset fixture with bounded displacement around an isochronous grid. */
export function syntheticOnsets(
  tempoBpm: number,
  jitterSeconds: number,
  count: number,
  seed: number,
): number[] {
  if (!Number.isFinite(tempoBpm) || tempoBpm <= 0) throw new RangeError("tempoBpm must be positive and finite");
  if (!Number.isFinite(jitterSeconds) || jitterSeconds < 0) {
    throw new RangeError("jitterSeconds must be non-negative and finite");
  }
  if (!Number.isSafeInteger(count) || count < 2) throw new RangeError("count must be an integer of at least two");
  const beatSeconds = 60 / tempoBpm;
  if (jitterSeconds * 2 >= beatSeconds) {
    throw new RangeError("jitterSeconds must be less than half the beat duration so onsets stay ordered");
  }
  const displacement = deterministicCenteredSample(0, jitterSeconds, count, seed);
  const origin = displacement[0];
  return displacement.map((offset, index) => index * beatSeconds + offset - origin);
}
