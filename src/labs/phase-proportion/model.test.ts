import { describe, expect, it } from "vitest";
import {
  bpmToPeriodSeconds,
  circularPhaseDifference,
  greatestCommonDivisor,
  leastCommonMultiple,
  normalizeCircularPhase,
  periodSecondsToBpm,
  phaseAtTime,
  reduceRatio,
  tempoRatio,
} from "./model";

describe("phase and proportion model", () => {
  it("round-trips BPM and beat period", () => {
    for (const bpm of [30, 60, 89.5, 120, 240]) {
      expect(periodSecondsToBpm(bpmToPeriodSeconds(bpm))).toBeCloseTo(bpm);
    }
    expect(tempoRatio(90, 135)).toBe(1.5);
  });

  it("reduces integer proportions and derives common cycles", () => {
    expect(reduceRatio(-12, -18)).toEqual({ numerator: 2, denominator: 3 });
    expect(greatestCommonDivisor(-84, 30)).toBe(6);
    expect(leastCommonMultiple(12, 18)).toBe(36);
    expect(leastCommonMultiple(0, 18)).toBe(0);
  });

  it("wraps circular phase with a stable boundary convention", () => {
    expect(normalizeCircularPhase(-0.25)).toBe(0.75);
    expect(normalizeCircularPhase(2)).toBe(0);
    expect(circularPhaseDifference(0.9, 0.1)).toBeCloseTo(0.2);
    expect(circularPhaseDifference(0.1, 0.9)).toBeCloseTo(-0.2);
    expect(phaseAtTime(1.25, 0.5)).toBe(0.5);
  });

  it("rejects invalid domains explicitly", () => {
    expect(() => bpmToPeriodSeconds(0)).toThrow("bpm must be greater than zero");
    expect(() => reduceRatio(1, 0)).toThrow("denominator must not be zero");
    expect(() => greatestCommonDivisor(1.5, 2)).toThrow("left must be a safe integer");
    expect(() => normalizeCircularPhase(Number.NaN)).toThrow("phaseCycles must be finite");
  });
});
