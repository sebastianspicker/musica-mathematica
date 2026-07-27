import { describe, expect, it } from "vitest";
import {
  describeEventAlignment,
  deterministicCenteredSample,
  median,
  parameterRecoveryError,
  quantile,
  recoverTempoFromOnsets,
  summarizeDistribution,
  syntheticOnsets,
} from "./model";

describe("measurement and inference model", () => {
  it("uses explicit robust and approximate uncertainty summaries", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(quantile([0, 10, 20, 30, 40], 0.25)).toBe(10);
    const summary = summarizeDistribution([1, 2, 3, 4, 5]);
    expect(summary).toMatchObject({
      count: 5,
      mean: 3,
      median: 3,
      firstQuartile: 2,
      thirdQuartile: 4,
      interquartileRange: 2,
    });
    expect(summary.approximate95Interval[0]).toBeLessThan(3);
    expect(summary.approximate95Interval[1]).toBeGreaterThan(3);
  });

  it("describes signed event alignment without a grade or score", () => {
    const description = describeEventAlignment(
      [12, 23, 34, 45],
      [10, 20, 30, 40],
      { unit: "ms" },
    );
    expect(description).toMatchObject({
      pairedEventCount: 4,
      signedDifferences: [2, 3, 4, 5],
      medianDifference: 3.5,
      interquartileRange: 1.5,
      direction: "observed-later",
      unit: "ms",
      calibration: "uncalibrated",
    });
    expect(description).not.toHaveProperty("score");
    expect(description).not.toHaveProperty("grade");
    expect(description.interpretation).not.toMatch(/better|worse|accurate|inaccurate/i);
  });

  it("distinguishes earlier and tolerance-centered event differences", () => {
    expect(describeEventAlignment([8, 18], [10, 20], { unit: "ms" }).direction)
      .toBe("observed-earlier");
    expect(describeEventAlignment([10.4, 19.6], [10, 20], { centeredTolerance: 0.5 }).direction)
      .toBe("centered");
  });

  it("recovers an isochronous generating tempo as a labeled hypothesis", () => {
    const recovery = recoverTempoFromOnsets([0, 0.5, 1, 1.5, 2]);
    expect(recovery).toMatchObject({
      onsetCount: 5,
      medianIntervalSeconds: 0.5,
      intervalIqrSeconds: 0,
      estimatedBpm: 120,
      label: "tempo hypothesis",
    });
    expect(parameterRecoveryError(recovery.estimatedBpm, 118)).toBe(2);
  });

  it("creates reproducible, bounded synthetic fixtures", () => {
    const first = deterministicCenteredSample(100, 8, 12, 9);
    const second = deterministicCenteredSample(100, 8, 12, 9);
    expect(first).toEqual(second);
    expect(first.every((value) => value >= 92 && value <= 108)).toBe(true);

    const onsets = syntheticOnsets(120, 0.01, 24, 77);
    expect(onsets).toEqual(syntheticOnsets(120, 0.01, 24, 77));
    expect(onsets.every((value, index) => index === 0 || value > onsets[index - 1])).toBe(true);
    expect(recoverTempoFromOnsets(onsets).estimatedBpm).toBeCloseTo(120, -1);
  });

  it("rejects mismatched pairs and unordered onsets", () => {
    expect(() => describeEventAlignment([1], [1, 2])).toThrow("same number");
    expect(() => describeEventAlignment([1], [1], { centeredTolerance: -1 })).toThrow("non-negative");
    expect(() => recoverTempoFromOnsets([0, 1, 0.5])).toThrow("strictly increasing");
  });
});
