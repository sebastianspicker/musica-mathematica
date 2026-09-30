import { describe, expect, it } from "vitest";
import type { FactorDefinition, FactorValue } from "../../curriculum/contracts";
import type { TrialSnapshotV2 } from "../portfolio/schema";
import { assessTrialComparison, changedFactorIds } from "./comparison";

const numberFactor = (id: string, label: string): FactorDefinition => ({
  id, kind: "number", label, min: 0, max: 10, step: 1, defaultValue: 1, help: "Test.",
});
const audioNumberFactor = (id: string, label: string): FactorDefinition => ({ ...numberFactor(id, label), audioSetting: "onsetSensitivity" } as FactorDefinition);
const audioSelectFactor = (id: string, label: string): FactorDefinition => ({
  id, kind: "select", label, defaultValue: "mixed", options: [{ value: "mixed", label: "Mixed" }], help: "Test.", audioSetting: "meterBias",
});
const factors = [audioNumberFactor("threshold", "Onset threshold"), audioSelectFactor("meterBias", "Candidate family"), numberFactor("other", "Other")];
const plainFactors = [numberFactor("threshold", "Onset threshold"), numberFactor("meterBias", "Candidate family"), numberFactor("other", "Other")];

function fileTrial(lessonId: string, values: Record<string, FactorValue>): TrialSnapshotV2 {
  return {
    id: "run",
    labId: "rhythm-meter",
    lessonId,
    protocolId: `rhythm-meter.${lessonId}.v1`,
    deterministic: false,
    recordedAt: "2026-08-28T10:00:00.000Z",
    factors: { threshold: 1, meterBias: 1, other: 1, ...values },
    observables: [],
    trace: [],
    provenance: { source: "file", calibration: "uncalibrated", method: "test", sampleRateHz: 44100, frameSize: 2048, hopSize: 1024 },
  };
}

describe("assessTrialComparison audio policy", () => {
  const onset = { id: "recorded-onset-hypotheses", factors };

  it("accepts a file comparison that changes only the onset threshold", () => {
    expect(assessTrialComparison(onset, [
      fileTrial(onset.id, {}),
      fileTrial(onset.id, { threshold: 2 }),
    ])).toEqual({
      valid: true,
      changedFactorIds: ["threshold"],
      reason: "Controlled comparison ready: only Onset threshold changed.",
    });
  });

  it("rejects a file comparison that changes only another factor", () => {
    expect(assessTrialComparison(onset, [
      fileTrial(onset.id, {}),
      fileTrial(onset.id, { other: 2 }),
    ])).toEqual({
      valid: false,
      changedFactorIds: ["other"],
      reason: "For recorded audio, compare a fresh analysis after changing only Onset threshold or Candidate family.",
    });
  });

  it("treats audio as an observation appendix in any other lesson", () => {
    const other = { id: "autocorrelation-spectrum-meter", factors: plainFactors };

    expect(assessTrialComparison(other, [
      fileTrial(other.id, {}),
      fileTrial(other.id, { threshold: 2 }),
    ])).toEqual({
      valid: false,
      changedFactorIds: ["threshold"],
      reason: "Local audio is an observation appendix in this lesson; use the synthetic model for a controlled A/B comparison.",
    });
  });
});

describe("changedFactorIds", () => {
  it("reports changed ids among the supplied ids, with a numeric tolerance and absent values", () => {
    expect(changedFactorIds(
      ["a", "b", "c", "d", "e"],
      { a: 1, b: 1, c: "x", d: true },
      { a: 1 + 1e-12, b: 1.001, c: "y", d: true, e: 2 },
    )).toEqual(["b", "c", "e"]);
  });
});
