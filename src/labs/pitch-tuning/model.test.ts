import { describe, expect, it } from "vitest";
import {
  approximateRatio,
  beatingPeriodSeconds,
  beatingRateHz,
  centsBetweenFrequencies,
  centsToRatio,
  edoStepRatio,
  edoStepsToRatio,
  nearestEdoSteps,
  ratioToCents,
} from "./model";

describe("pitch and tuning model", () => {
  it("round-trips ratios and cents", () => {
    for (const ratio of [0.5, 1, 3 / 2, 2, 5]) {
      expect(centsToRatio(ratioToCents(ratio))).toBeCloseTo(ratio);
    }
    expect(centsBetweenFrequencies(440, 880)).toBeCloseTo(1200);
  });

  it("maps equal temperament steps deterministically", () => {
    expect(edoStepRatio(12)).toBeCloseTo(2 ** (1 / 12));
    expect(edoStepsToRatio(12, 12)).toBe(2);
    expect(nearestEdoSteps(3 / 2, 12)).toBe(7);
  });

  it("uses continued fractions for bounded rational approximations", () => {
    expect(approximateRatio(Math.PI, 16)).toMatchObject({ numerator: 22, denominator: 7 });
    expect(approximateRatio(1.5, 8)).toEqual({ numerator: 3, denominator: 2, value: 1.5, error: 0 });
  });

  it("calculates idealised beating from frequency separation", () => {
    expect(beatingRateHz(440, 442)).toBe(2);
    expect(beatingPeriodSeconds(440, 442)).toBe(0.5);
    expect(beatingPeriodSeconds(440, 440)).toBeNull();
  });

  it("rejects invalid numerical domains", () => {
    expect(() => ratioToCents(0)).toThrow("ratio must be a positive finite number");
    expect(() => centsToRatio(Number.NaN)).toThrow("cents must be finite");
    expect(() => edoStepRatio(0)).toThrow("divisionsPerOctave must be a positive safe integer");
    expect(() => approximateRatio(1, 0)).toThrow("maxDenominator must be a positive safe integer");
  });
});
