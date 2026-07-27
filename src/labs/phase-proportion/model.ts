const EPSILON = 1e-12;

export type Rational = Readonly<{ numerator: number; denominator: number }>;

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
}

function assertPositive(name: string, value: number): void {
  assertFinite(name, value);
  if (value <= 0) {
    throw new RangeError(`${name} must be greater than zero`);
  }
}

function assertInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer`);
  }
}

/** Converts a tempo in beats per minute to the duration of one beat. */
export function bpmToPeriodSeconds(bpm: number): number {
  assertPositive("bpm", bpm);
  return 60 / bpm;
}

/** Converts a beat duration in seconds to beats per minute. */
export function periodSecondsToBpm(periodSeconds: number): number {
  assertPositive("periodSeconds", periodSeconds);
  return 60 / periodSeconds;
}

/** Returns the multiplicative tempo relation `target / source`. */
export function tempoRatio(sourceBpm: number, targetBpm: number): number {
  assertPositive("sourceBpm", sourceBpm);
  assertPositive("targetBpm", targetBpm);
  return targetBpm / sourceBpm;
}

export function greatestCommonDivisor(left: number, right: number): number {
  assertInteger("left", left);
  assertInteger("right", right);
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function leastCommonMultiple(left: number, right: number): number {
  assertInteger("left", left);
  assertInteger("right", right);
  if (left === 0 || right === 0) {
    return 0;
  }
  return Math.abs((left / greatestCommonDivisor(left, right)) * right);
}

/** Reduces an integer proportion and keeps its sign in the numerator. */
export function reduceRatio(numerator: number, denominator: number): Rational {
  assertInteger("numerator", numerator);
  assertInteger("denominator", denominator);
  if (denominator === 0) {
    throw new RangeError("denominator must not be zero");
  }
  if (numerator === 0) {
    return { numerator: 0, denominator: 1 };
  }
  const divisor = greatestCommonDivisor(numerator, denominator);
  const sign = denominator < 0 ? -1 : 1;
  return { numerator: sign * (numerator / divisor), denominator: sign * (denominator / divisor) };
}

/** Wraps a phase measured in cycles into the half-open interval [0, 1). */
export function normalizeCircularPhase(phaseCycles: number): number {
  assertFinite("phaseCycles", phaseCycles);
  const phase = phaseCycles % 1;
  return Math.abs(phase) < EPSILON ? 0 : phase < 0 ? phase + 1 : phase;
}

/** Returns the shortest signed movement from `fromCycles` to `toCycles`, in [-0.5, 0.5). */
export function circularPhaseDifference(fromCycles: number, toCycles: number): number {
  assertFinite("fromCycles", fromCycles);
  assertFinite("toCycles", toCycles);
  return normalizeCircularPhase(toCycles - fromCycles + 0.5) - 0.5;
}

/** Returns a point's circular phase after an elapsed duration. */
export function phaseAtTime(elapsedSeconds: number, periodSeconds: number): number {
  assertFinite("elapsedSeconds", elapsedSeconds);
  assertPositive("periodSeconds", periodSeconds);
  return normalizeCircularPhase(elapsedSeconds / periodSeconds);
}
