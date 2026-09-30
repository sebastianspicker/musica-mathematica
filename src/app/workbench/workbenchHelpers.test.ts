import { describe, expect, it } from "vitest";
import { curriculumRegistry } from "../../curriculum/catalog";
import { createDemoPortfolio } from "../demo/demoPortfolio";
import { activeAttempt, recordTrial } from "../../learning/portfolio/aggregate";
import { defaultFactorsFor } from "../../curriculum/contracts";
import { factorsForAttempt, recordedRunWasTrimmed, recordingBlocker } from "./workbenchHelpers";
import type { EvaluationOutput } from "../../curriculum/contracts";

describe("factorsForAttempt", () => {
  it("retries with explicit defaults without changing the saved attempt", () => {
    const lesson = curriculumRegistry.defaultLesson;
    const attempt = activeAttempt(curriculumRegistry, createDemoPortfolio(curriculumRegistry));
    const saved = JSON.stringify(attempt);
    const factors = factorsForAttempt(lesson, attempt, defaultFactorsFor(lesson));
    expect(factors).toEqual({ bpm: 90, beatsPerBar: 4 });
    expect(JSON.stringify(attempt)).toBe(saved);
    expect(attempt.trials.map((trial) => trial.factors.bpm)).toEqual([90, 120]);
  });

  it("normally resumes the latest recorded trial", () => {
    const portfolio = createDemoPortfolio(curriculumRegistry);
    const lesson = curriculumRegistry.defaultLesson;
    const attempt = activeAttempt(curriculumRegistry, portfolio);

    expect(factorsForAttempt(lesson, attempt)).toEqual({ bpm: 120, beatsPerBar: 4 });
  });

  it("accepts an explicit initial view without changing recorded trial order", () => {
    const portfolio = createDemoPortfolio(curriculumRegistry);
    const lesson = curriculumRegistry.defaultLesson;
    const attempt = activeAttempt(curriculumRegistry, portfolio);

    expect(factorsForAttempt(lesson, attempt, attempt.trials[0]?.factors)).toEqual({
      bpm: 90,
      beatsPerBar: 4,
    });
    expect(attempt.trials.map((trial) => trial.factors.bpm)).toEqual([90, 120]);
  });
});

describe("recorded run trimming notice", () => {
  const savedAttempt = activeAttempt(curriculumRegistry, createDemoPortfolio(curriculumRegistry));
  const attempt = { ...savedAttempt, stage: "experiment" as const };
  const trial = { ...attempt.trials[0]!, id: "Run 3" };

  it("does not report an unchanged accepted run", () => {
    const next = recordTrial(curriculumRegistry, attempt, trial);
    expect(next).not.toBe(attempt);
    expect(recordedRunWasTrimmed(attempt, trial, next)).toBe(false);
  });

  it("reports a shortened Unicode note", () => {
    const submitted = { ...trial, note: "🎼".repeat(16_385) };
    const next = recordTrial(curriculumRegistry, attempt, submitted);
    expect(recordedRunWasTrimmed(attempt, submitted, next)).toBe(true);
  });

  it("reports removal of the oldest run when recording a thirteenth", () => {
    const previous = { ...attempt, trials: Array.from({ length: 12 }, (_, i) => ({ ...trial, id: `Run ${i + 1}` })) };
    const submitted = { ...trial, id: "Run 13" };
    const next = recordTrial(curriculumRegistry, previous, submitted);
    expect(next.trials).toHaveLength(12);
    expect(recordedRunWasTrimmed(previous, submitted, next)).toBe(true);
  });

  it("reports reduced trace data", () => {
    const submitted = { ...trial, trace: Array.from({ length: 300 }, (_, x) => ({ x, y: x, series: "test" })) };
    const next = recordTrial(curriculumRegistry, attempt, submitted);
    expect(next.trials.at(-1)?.trace).toHaveLength(256);
    expect(recordedRunWasTrimmed(attempt, submitted, next)).toBe(true);
  });
});

describe("recordingBlocker", () => {
  const savedAttempt = activeAttempt(curriculumRegistry, createDemoPortfolio(curriculumRegistry));
  const attempt = { ...savedAttempt, stage: "experiment" as const };
  const onsetLesson = curriculumRegistry.lessonById("rhythm-meter", "recorded-onset-hypotheses")!;
  const otherLesson = curriculumRegistry.lessonById("rhythm-meter", "autocorrelation-spectrum-meter")!;
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

  it("allows file recording only in the recorded-onset lesson", () => {
    expect(recordingBlocker(attempt, "file", fileEvaluation, onsetLesson)).toBeUndefined();
    expect(recordingBlocker(attempt, "file", fileEvaluation, otherLesson))
      .toBe("Local audio is an observation appendix in this lesson. Use the synthetic model for a controlled A/B run.");
  });
});
