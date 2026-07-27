import { describe, expect, it } from "vitest";
import { defaultLabLesson, labLessonById } from "../labs/catalog";
import type { TrialSnapshotV2 } from "../labs/types";
import { assessTrialComparison } from "./trialComparison";

const trial = (id: string, bpm: number, beatsPerBar = 4): TrialSnapshotV2 => ({
  id,
  labId: defaultLabLesson.labId,
  lessonId: defaultLabLesson.id,
  protocolId: defaultLabLesson.protocol.id,
  deterministic: true,
  recordedAt: "2026-07-17T12:00:00.000Z",
  factors: { bpm, beatsPerBar },
  observables: [],
  trace: [],
  provenance: { source: "model", calibration: "uncalibrated", method: "fixture" },
});

function recordedOnsetLesson(): NonNullable<ReturnType<typeof labLessonById>> {
  const onset = labLessonById("rhythm-meter", "recorded-onset-hypotheses");
  if (!onset) throw new Error("Recorded-onset lesson missing");
  return onset;
}

describe("domain-neutral trial comparison", () => {
  it("requires two runs and exactly one catalog factor change", () => {
    expect(assessTrialComparison(defaultLabLesson, [trial("A", 90)]).valid).toBe(false);
    expect(assessTrialComparison(defaultLabLesson, [trial("A", 90), trial("B", 90)]).reason).toContain("Change one");
    expect(assessTrialComparison(defaultLabLesson, [trial("A", 90), trial("B", 120)]).valid).toBe(true);
    expect(assessTrialComparison(defaultLabLesson, [trial("A", 90), trial("B", 120, 3)]).reason).toContain("change one factor only");
  });

  it("rejects comparisons across lesson protocol revisions", () => {
    const legacy = { ...trial("A", 90), protocolId: `${defaultLabLesson.protocol.id}.legacy-v1` };

    expect(assessTrialComparison(defaultLabLesson, [legacy, trial("B", 120)]).reason).toContain(
      "same lesson protocol",
    );
  });

  it("rejects source and frame-setting changes that invalidate an audio comparison", () => {
    const onset = recordedOnsetLesson();
    const left = audioTrial("A", onset, { tempoBpm: 108, threshold: 0.35, meterBias: "mixed" });
    const sourceChanged = { ...audioTrial("B", onset, { tempoBpm: 108, threshold: 0.4, meterBias: "mixed" }), provenance: { ...left.provenance, source: "microphone" as const } };
    const frameChanged = { ...audioTrial("B", onset, { tempoBpm: 108, threshold: 0.4, meterBias: "mixed" }), provenance: { ...left.provenance, frameSize: 4096 } };

    expect(assessTrialComparison(onset, [left, sourceChanged]).reason).toContain("same analysis source");
    expect(assessTrialComparison(onset, [left, frameChanged]).reason).toContain("frame size");
  });

  it("permits only freshly analyzed onset settings as audio comparison factors", () => {
    const onset = recordedOnsetLesson();
    const left = audioTrial("A", onset, { tempoBpm: 108, threshold: 0.35, meterBias: "mixed" });
    const threshold = audioTrial("B", onset, { tempoBpm: 108, threshold: 0.4, meterBias: "mixed" });
    const syntheticTempo = audioTrial("B", onset, { tempoBpm: 120, threshold: 0.35, meterBias: "mixed" });

    expect(assessTrialComparison(onset, [left, threshold]).valid).toBe(true);
    expect(assessTrialComparison(onset, [left, syntheticTempo]).reason).toContain("Onset threshold or Candidate family");
  });
});

function audioTrial(
  id: string,
  lesson: NonNullable<ReturnType<typeof labLessonById>>,
  factors: TrialSnapshotV2["factors"],
): TrialSnapshotV2 {
  return {
    id,
    labId: lesson.labId,
    lessonId: lesson.id,
    protocolId: lesson.protocol.id,
    deterministic: false,
    recordedAt: "2026-07-17T12:00:00.000Z",
    factors,
    observables: [],
    trace: [],
    provenance: {
      source: "file",
      calibration: "uncalibrated",
      method: "fixture",
      sampleRateHz: 48_000,
      frameSize: 2048,
      hopSize: 1024,
    },
  };
}
