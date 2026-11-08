import { describe, expect, it } from "vitest";
import { stationaryDistribution } from "./model";

describe("stationaryDistribution", () => {
  it("solves an asymmetric two-state chain", () => {
    const [a, b] = stationaryDistribution([[0.9, 0.1], [0.5, 0.5]]);
    expect(a).toBeCloseTo(5 / 6, 6);
    expect(b).toBeCloseTo(1 / 6, 6);
  });
});
