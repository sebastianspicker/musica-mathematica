import { describe, expect, it } from "vitest";
import { euclideanRhythm, rankMeterCandidates } from "./model";

describe("rankMeterCandidates", () => {
  it("never offers one step per beat", () => {
    const ranked = rankMeterCandidates(euclideanRhythm(4, 4));
    expect(ranked.some((c) => c.subdivisionsPerBeat < 2)).toBe(false);
  });

  it("ranks E(5,12) by chance-corrected score", () => {
    const ranked = rankMeterCandidates(euclideanRhythm(5, 12));
    expect(ranked.map((c) => [c.beats, c.score])).toEqual([[3, 0.2], [6, 0.2], [4, 0.1], [2, 0.04]]);
  });

  it("returns finite scores or nothing for prime step counts", () => {
    for (const steps of [5, 7]) {
      expect(rankMeterCandidates(euclideanRhythm(3, steps))).toEqual([]);
    }
  });
});
