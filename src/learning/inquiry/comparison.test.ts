import { describe, expect, it } from "vitest";
import type { FactorDefinition, FactorValue } from "../../curriculum/contracts";
import type { TrialSnapshotV2 } from "../portfolio/schema-v2";
import { assessTrialComparison } from "./comparison";

const numberFactor = (id: string, label: string): FactorDefinition => ({
  id, kind: "number", label, min: 0, max: 10, step: 1, defaultValue: 1, help: "Test.",
});
const factors = [numberFactor("threshold", "Onset threshold"), numberFactor("meterBias", "Candidate family"), numberFactor("other", "Other")];

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
      reason: "For recorded-onset audio, compare a fresh analysis after changing only Onset threshold or Candidate family.",
    });
  });

  it("treats audio as an observation appendix in any other lesson", () => {
    const other = { id: "autocorrelation-spectrum-meter", factors };

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
