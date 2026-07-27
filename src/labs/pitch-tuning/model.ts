import { assertPositiveFinite, assertPositiveInteger } from "../../numericValidation";

export type RationalApproximation = Readonly<{
  numerator: number;
  denominator: number;
  value: number;
  error: number;
}>;

export function ratioToCents(ratio: number): number {
  assertPositiveFinite("ratio", ratio);
  return 1200 * Math.log2(ratio);
}

export function centsToRatio(cents: number): number {
  if (!Number.isFinite(cents)) {
    throw new RangeError("cents must be finite");
  }
  return 2 ** (cents / 1200);
}

export function centsBetweenFrequencies(referenceHz: number, targetHz: number): number {
  assertPositiveFinite("referenceHz", referenceHz);
  assertPositiveFinite("targetHz", targetHz);
  return ratioToCents(targetHz / referenceHz);
}

export function edoStepRatio(divisionsPerOctave: number): number {
  assertPositiveInteger("divisionsPerOctave", divisionsPerOctave);
  return 2 ** (1 / divisionsPerOctave);
}

export function edoStepsToRatio(steps: number, divisionsPerOctave: number): number {
  if (!Number.isFinite(steps)) {
    throw new RangeError("steps must be finite");
  }
  assertPositiveInteger("divisionsPerOctave", divisionsPerOctave);
  return 2 ** (steps / divisionsPerOctave);
}

export function nearestEdoSteps(ratio: number, divisionsPerOctave: number): number {
  assertPositiveFinite("ratio", ratio);
  assertPositiveInteger("divisionsPerOctave", divisionsPerOctave);
  return Math.round(divisionsPerOctave * Math.log2(ratio));
}

/** Finds the closest positive rational with a bounded denominator using continued fractions. */
export function approximateRatio(value: number, maxDenominator: number): RationalApproximation {
  assertPositiveFinite("value", value);
  assertPositiveInteger("maxDenominator", maxDenominator);
  let x = value;
  let previousNumerator = 0;
  let numerator = 1;
  let previousDenominator = 1;
  let denominator = 0;
  for (;;) {
    const coefficient = Math.floor(x);
    const nextNumerator = coefficient * numerator + previousNumerator;
    const nextDenominator = coefficient * denominator + previousDenominator;
    if (nextDenominator > maxDenominator) {
      const multiplier = Math.floor((maxDenominator - previousDenominator) / denominator);
      const boundedNumerator = multiplier * numerator + previousNumerator;
      const boundedDenominator = multiplier * denominator + previousDenominator;
      const useBounded = boundedDenominator > 0 && Math.abs(boundedNumerator / boundedDenominator - value) < Math.abs(numerator / denominator - value);
      const resultNumerator = useBounded ? boundedNumerator : numerator;
      const resultDenominator = useBounded ? boundedDenominator : denominator;
      return { numerator: resultNumerator, denominator: resultDenominator, value: resultNumerator / resultDenominator, error: Math.abs(resultNumerator / resultDenominator - value) };
    }
    [previousNumerator, numerator] = [numerator, nextNumerator];
    [previousDenominator, denominator] = [denominator, nextDenominator];
    const remainder = x - coefficient;
    if (remainder === 0) {
      return { numerator, denominator, value: numerator / denominator, error: Math.abs(numerator / denominator - value) };
    }
    x = 1 / remainder;
  }
}

/** The absolute frequency separation, which is the idealised beating-rate model. */
export function beatingRateHz(firstHz: number, secondHz: number): number {
  assertPositiveFinite("firstHz", firstHz);
  assertPositiveFinite("secondHz", secondHz);
  return Math.abs(secondHz - firstHz);
}

export function beatingPeriodSeconds(firstHz: number, secondHz: number): number | null {
  const rate = beatingRateHz(firstHz, secondHz);
  return rate === 0 ? null : 1 / rate;
}
