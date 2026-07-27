import { describe, expect, it } from "vitest";
import {
  intervalClassVector,
  invertPitchClasses,
  minimalVoiceLeading,
  normalizePitchClass,
  shortestPath,
  transposePitchClasses,
} from "./model";

describe("harmony geometry model", () => {
  it("normalizes, transposes, and inverts pitch classes modulo twelve", () => {
    expect(normalizePitchClass(-13)).toBe(11);
    expect(transposePitchClasses([11, 2, -1], 3)).toEqual([2, 5, 2]);
    expect(invertPitchClasses([0, 4, 7])).toEqual([0, 8, 5]);
  });

  it("uses the same nonzero T/I index n as I_n(x) = n - x modulo twelve", () => {
    expect(invertPitchClasses([0, 4, 7], 5)).toEqual([5, 1, 10]);
  });

  it("keeps transposition and inversion inside the pitch-class domain", () => {
    for (let pitchClass = -24; pitchClass <= 24; pitchClass += 1) {
      expect(transposePitchClasses([pitchClass], 12)[0]).toBe(normalizePitchClass(pitchClass));
      expect(invertPitchClasses(invertPitchClasses([pitchClass]))[0]).toBe(normalizePitchClass(pitchClass));
    }
  });

  it("computes an interval-class vector for a major triad", () => {
    expect(intervalClassVector([0, 4, 7])).toEqual([0, 0, 1, 1, 1, 0]);
  });

  it("finds the minimum assignment rather than preserving chord order", () => {
    const leading = minimalVoiceLeading([0, 4, 7], [7, 0, 4]);
    expect(leading.distance).toBe(0);
    expect(leading.moves.map((move) => move.toIndex)).toEqual([1, 2, 0]);
  });

  it("uses circular shortest motion for each assigned voice", () => {
    const leading = minimalVoiceLeading([11], [1]);
    expect(leading).toEqual({
      distance: 2,
      moves: [{ fromIndex: 0, toIndex: 0, from: 11, to: 1, semitones: 2 }],
    });
  });

  it("returns the least-cost route and reports disconnected nodes", () => {
    const edges = [
      { from: 0, to: 1, weight: 2 },
      { from: 0, to: 2, weight: 1 },
      { from: 2, to: 1, weight: 0.5 },
      { from: 1, to: 3, weight: 1 },
      { from: 2, to: 3, weight: 5 },
    ];
    expect(shortestPath(5, edges, 0, 3)).toEqual([0, 2, 1, 3]);
    expect(shortestPath(5, edges, 0, 4)).toBeNull();
    expect(shortestPath(5, edges, 2, 2)).toEqual([2]);
  });

  it("rejects malformed pitch classes, voice-leading pairs, and graph weights", () => {
    expect(() => normalizePitchClass(0.5)).toThrow(RangeError);
    expect(() => minimalVoiceLeading([0], [0, 4])).toThrow(/same number/);
    expect(() => shortestPath(2, [{ from: 0, to: 1, weight: -1 }], 0, 1)).toThrow(/non-negative/);
    expect(() => shortestPath(2, [{ from: 0, to: 2, weight: 1 }], 0, 1)).toThrow(/existing node/);
    expect(() => shortestPath(2, [], -1, 1)).toThrow(/existing node/);
  });
});
