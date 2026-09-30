import { assertPositiveFinite, assertPositiveInteger } from "../../shared/numeric/validation";

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

/** The absolute frequency separation, which is the idealised beating-rate model. */
export function beatingRateHz(firstHz: number, secondHz: number): number {
  assertPositiveFinite("firstHz", firstHz);
  assertPositiveFinite("secondHz", secondHz);
  return Math.abs(secondHz - firstHz);
}
