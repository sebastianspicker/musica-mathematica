import { describe, expect, it } from "vitest";
import { defaultConfig } from "../simulation/presets";
import { metricsFor, createInitialState } from "../simulation/ensemble";
import type { RunSnapshot } from "./lessonAttempt";
import { assessControlledComparison } from "./comparison";

function run(id: string, patch: Partial<typeof defaultConfig> = {}): RunSnapshot {
  const config = { ...defaultConfig, ...patch };
  return {
    id,
    config,
    durationSeconds: 1,
    metrics: metricsFor(createInitialState(config), config),
  };
}

describe("assessControlledComparison", () => {
  it("accepts changes limited to the lesson's recommended controls", () => {
    const result = assessControlledComparison(
      [run("a"), run("b", { couplingStrength: 2 })],
      ["couplingStrength"],
    );

    expect(result.valid).toBe(true);
    expect(result.changedFields).toEqual(["couplingStrength"]);
  });

  it("rejects identical runs and unrelated changes", () => {
    expect(assessControlledComparison([run("a"), run("b")], ["couplingStrength"]).valid).toBe(false);
    expect(
      assessControlledComparison(
        [run("a"), run("b", { tempoBpm: 90 })],
        ["couplingStrength"],
      ).reason,
    ).toContain("tempoBpm");
  });

  it("requires one changed control unless the lesson defines a strategy pair", () => {
    const pairedRuns = [
      run("a"),
      run("b", { couplingStrength: 2, clickTrackStrength: 1 }),
    ];

    expect(assessControlledComparison(
      pairedRuns,
      ["couplingStrength", "clickTrackStrength"],
    )).toMatchObject({ valid: false, reason: expect.stringContaining("exactly one") });
    expect(assessControlledComparison(
      pairedRuns,
      ["couplingStrength", "clickTrackStrength"],
      "all-recommended-controls",
    ).valid).toBe(true);
    expect(assessControlledComparison(
      [run("a"), run("b", { couplingStrength: 2 })],
      ["couplingStrength", "clickTrackStrength"],
      "all-recommended-controls",
    ).reason).toContain("clickTrackStrength");
  });
});
