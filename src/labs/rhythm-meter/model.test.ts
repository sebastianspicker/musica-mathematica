import { describe, expect, it } from "vitest";
import { analyzeRhythm, circularAutocorrelation, euclideanRhythm, rankMeterCandidates, rotateRhythm } from "./model";

describe("rhythm and meter model", () => {
  it("produces a deterministic Euclidean golden pattern and preserves pulse count", () => {
    expect(euclideanRhythm(3, 8)).toEqual([1, 0, 0, 1, 0, 0, 1, 0]);
    for (let steps = 1; steps <= 16; steps += 1) {
      for (let pulses = 0; pulses <= steps; pulses += 1) {
        expect(euclideanRhythm(pulses, steps).reduce((sum, value) => sum + value, 0)).toBe(pulses);
      }
    }
  });

  it("rotates and finds circular recurrence", () => {
    const pattern = [1, 0, 0, 1, 0, 0, 1, 0];
    expect(rotateRhythm(pattern, 2)).toEqual([1, 0, 1, 0, 0, 1, 0, 0]);
    expect(circularAutocorrelation(pattern)).toEqual([3, 0, 1, 2, 0, 2, 1, 0]);
  });

  it("returns DFT-friendly analysis and deterministic meter candidates", () => {
    const analysis = analyzeRhythm([1, 0, 1, 0]);
    expect(analysis).toMatchObject({ pulseCount: 2, density: 0.5, autocorrelation: [2, 0, 2, 0] });
    expect(analysis.spectrum[0].magnitude).toBeCloseTo(2);
    expect(analysis.spectrum[2].magnitude).toBeCloseTo(2);
    expect(rankMeterCandidates([1, 0, 1, 0, 1, 0, 1, 0], [2, 4])).toEqual([
      { beats: 2, subdivisionsPerBeat: 4, score: 0.5 },
      { beats: 4, subdivisionsPerBeat: 2, score: 1 },
    ].sort((a, b) => b.score - a.score || a.beats - b.beats));
  });

  it("rejects malformed rhythms and invalid candidate grids", () => {
    expect(() => euclideanRhythm(5, 4)).toThrow("between zero and steps");
    expect(() => rotateRhythm([], 1)).toThrow("pattern must not be empty");
    expect(() => analyzeRhythm([1, 2])).toThrow("only 0 and 1");
    expect(() => rankMeterCandidates([1, 0, 0, 1], [2.5])).toThrow("beats must be a positive safe integer");
  });
});
