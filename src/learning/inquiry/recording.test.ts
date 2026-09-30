import { describe, expect, it } from "vitest";
import { defaultFactorsFor, type EvaluationOutput, type LessonDefinition } from "../../curriculum/contracts";
import { createAttemptV2 } from "../portfolio/aggregate";
import { testCurriculum } from "../portfolio/curriculumFixture.test-helper";
import type { LessonAttemptV2, TrialSnapshotV2 } from "../portfolio/schema";
import { factorsForAttempt, recordingBlocker } from "./recording";

const lesson = testCurriculum.defaultLesson;
const orient = createAttemptV2(testCurriculum, "phase-proportion", "from-bpm-to-period", "2026-08-28T10:00:00.000Z");

function trial(id: string, bpm: number): TrialSnapshotV2 {
  return {
    id,
    labId: "phase-proportion",
    lessonId: "from-bpm-to-period",
    protocolId: "phase-proportion.from-bpm-to-period.v1",
    deterministic: true,
    recordedAt: "2026-08-28T10:00:00.000Z",
    factors: { bpm, beatsPerBar: 4 },
    observables: [],
    trace: [],
    provenance: { source: "model", calibration: "uncalibrated", method: "test" },
  };
}

describe("factorsForAttempt", () => {
  const attempt: LessonAttemptV2 = { ...orient, stage: "compare", trials: [trial("Run A", 90), trial("Run B", 120)] };

  it("retries with explicit defaults without changing the saved attempt", () => {
    const saved = JSON.stringify(attempt);
    const factors = factorsForAttempt(lesson, attempt, defaultFactorsFor(lesson));
    expect(factors).toEqual({ bpm: 1, beatsPerBar: 1 });
    expect(JSON.stringify(attempt)).toBe(saved);
    expect(attempt.trials.map((item) => item.factors.bpm)).toEqual([90, 120]);
  });

  it("normally resumes the latest recorded trial", () => {
    expect(factorsForAttempt(lesson, attempt)).toEqual({ bpm: 120, beatsPerBar: 4 });
  });

  it("accepts an explicit initial view without changing recorded trial order", () => {
    expect(factorsForAttempt(lesson, attempt, attempt.trials[0]?.factors)).toEqual({ bpm: 90, beatsPerBar: 4 });
    expect(attempt.trials.map((item) => item.factors.bpm)).toEqual([90, 120]);
  });

  it("falls back to defaults without recorded trials", () => {
    expect(factorsForAttempt(lesson, orient)).toEqual({ bpm: 1, beatsPerBar: 1 });
  });
});

describe("recordingBlocker", () => {
  const attempt: LessonAttemptV2 = { ...orient, stage: "experiment" };
  const otherLesson = lesson;
  const onsetLesson: LessonDefinition = {
    ...lesson,
    factors: [{ id: "onsetSensitivity", kind: "number", label: "Onset sensitivity", min: 0, max: 1, step: 0.1, defaultValue: 0.5, help: "Synthetic.", audioSetting: "onsetSensitivity" }],
  };
  const fileEvaluation = {
    provenance: { source: "file", calibration: "uncalibrated", method: "test" },
  } as unknown as EvaluationOutput;

  it("never blocks synthetic recording in the experiment stage", () => {
    expect(recordingBlocker(attempt, "synthetic", null, onsetLesson)).toBeUndefined();
    expect(recordingBlocker(attempt, "synthetic", null, otherLesson)).toBeUndefined();
  });

  it("requires the experiment stage", () => {
    expect(recordingBlocker({ ...attempt, stage: "predict" }, "synthetic", null, onsetLesson))
      .toBe("Open the experiment stage before recording a run.");
  });

  it("requires a fresh analysis from the selected file source", () => {
    expect(recordingBlocker(attempt, "file", null, onsetLesson))
      .toBe("Capture or decode a bounded local segment before recording a microphone or file analysis.");
    expect(recordingBlocker(attempt, "microphone", fileEvaluation, onsetLesson))
      .toBe("Analyze a fresh bounded segment from the selected source before recording a run.");
  });

  it("allows file recording only in a lesson with audio analysis factors", () => {
    expect(recordingBlocker(attempt, "file", fileEvaluation, onsetLesson)).toBeUndefined();
    expect(recordingBlocker(attempt, "file", fileEvaluation, otherLesson))
      .toBe("Local audio is an observation appendix in this lesson. Use the synthetic model for a controlled A/B run.");
  });
});
