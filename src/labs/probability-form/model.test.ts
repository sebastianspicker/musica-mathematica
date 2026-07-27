import { describe, expect, it } from "vitest";
import {
  createSeededRandom,
  entropy,
  generateMarkovSequence,
  normalizeTransitionMatrix,
  stationaryDistribution,
  surprisal,
} from "./model";

describe("probability form model", () => {
  it("has a reproducible seeded random golden trace", () => {
    const random = createSeededRandom(42);
    expect([random(), random(), random(), random()]).toEqual([
      0.6011037519201636,
      0.44829055899754167,
      0.8524657934904099,
      0.6697340414393693,
    ]);
  });

  it("normalizes transition weights by row without mutating the source matrix", () => {
    const source = [[2, 6], [3, 1]];
    expect(normalizeTransitionMatrix(source)).toEqual([[0.25, 0.75], [0.75, 0.25]]);
    expect(source).toEqual([[2, 6], [3, 1]]);
  });

  it("generates a deterministic state sequence that includes the initial state", () => {
    const matrix = [[1, 3], [4, 0]];
    expect(generateMarkovSequence(matrix, 0, 8, createSeededRandom(7))).toEqual([0, 0, 0, 1, 0, 1, 0, 1]);
  });

  it("converges to the known stationary distribution", () => {
    const distribution = stationaryDistribution([[9, 1], [2, 8]]);
    expect(distribution[0]).toBeCloseTo(2 / 3, 8);
    expect(distribution[1]).toBeCloseTo(1 / 3, 8);
  });

  it("computes entropy and surprisal in bits", () => {
    expect(entropy([0.5, 0.5])).toBe(1);
    expect(entropy([1, 0])).toBe(0);
    expect(surprisal(0.125)).toBe(3);
  });

  it("rejects invalid matrix rows, distributions, random outputs, and convergence settings", () => {
    expect(() => normalizeTransitionMatrix([[0, 0], [1, 1]])).toThrow(/positive total/);
    expect(() => normalizeTransitionMatrix([[1, 1, 1], [1, 1, 1]])).toThrow(/square/);
    expect(() => entropy([0.2, 0.2])).toThrow(/sum to 1/);
    expect(() => generateMarkovSequence([[1]], 0, 2, () => 1)).toThrow(/\[0, 1\)/);
    expect(() => stationaryDistribution([[0.999, 0.001], [0.2, 0.8]], 1e-20, 1)).toThrow(/did not converge/);
  });
});
