import { describe, expect, it } from "vitest";
import {
  type TrialSnapshotV2,
  maximumResponseCodePoints,
  maximumTracePointsPerTrial,
} from "./schema";
import {
  activeAttempt,
  advanceAttempt,
  createAttemptV2,
  createPortfolio,
  createTrialSnapshot,
  recordTrial,
  recordedRunWasTrimmed,
  runLabel,
  setAttemptPrediction,
  setAttemptResponse,
  updateAttempt,
} from "./aggregate";
import type { EvaluationOutput } from "../../curriculum/contracts";
import { testCurriculum } from "./curriculumFixture.test-helper";

describe("portfolio aggregate", () => {
  it("retains the complete inquiry gate chain", () => {
    const orient = createAttemptV2(testCurriculum, "phase-proportion", "from-bpm-to-period", "2026-08-28T10:00:00.000Z");
    expect(advanceAttempt(orient, "predict", "2026-08-28T10:01:00.000Z").stage).toBe("predict");
    expect(advanceAttempt(orient, "experiment", "2026-08-28T10:01:00.000Z")).toBe(orient);

    const predicted = setAttemptPrediction(orient, "The period halves.", "2026-08-28T10:01:00.000Z");
    const experiment = advanceAttempt(predicted, "experiment", "2026-08-28T10:02:00.000Z");
    const oneTrial = recordTrial(testCurriculum, experiment, trial("Run A"), "2026-08-28T10:03:00.000Z");
    expect(advanceAttempt(oneTrial, "compare", "2026-08-28T10:04:00.000Z")).toBe(oneTrial);

    const twoTrials = recordTrial(testCurriculum, oneTrial, trial("Run B"), "2026-08-28T10:04:00.000Z");
    const compare = advanceAttempt(twoTrials, "compare", "2026-08-28T10:05:00.000Z");
    const explain = advanceAttempt(compare, "explain", "2026-08-28T10:06:00.000Z");
    expect(advanceAttempt(explain, "perform", "2026-08-28T10:07:00.000Z")).toBe(explain);

    const explained = setAttemptResponse(explain, "explanation", "Tempo and period are inverse.", "2026-08-28T10:07:00.000Z");
    const perform = advanceAttempt(explained, "perform", "2026-08-28T10:08:00.000Z");
    const reflected = setAttemptResponse(perform, "performanceReflection", "I kept the pulse steady.", "2026-08-28T10:09:00.000Z");
    const transfer = advanceAttempt(reflected, "transfer", "2026-08-28T10:10:00.000Z");
    const transferred = setAttemptResponse(transfer, "transferResponse", "I can set a pulse from tempo.", "2026-08-28T10:11:00.000Z");

    expect(advanceAttempt(transferred, "debrief", "2026-08-28T10:12:00.000Z").stage).toBe("debrief");
  });

  it("caps a stored trace while retaining both endpoints", () => {
    const experiment = advanceAttempt(
      setAttemptPrediction(createAttemptV2(testCurriculum, "phase-proportion", "from-bpm-to-period"), "The period halves."),
      "experiment",
    );
    const trace = Array.from({ length: 1000 }, (_, x) => ({ x, y: x / 1000, series: "period" }));
    const recorded = recordTrial(testCurriculum, experiment, trial("Run A", trace));

    expect(recorded.trials[0]?.trace).toHaveLength(maximumTracePointsPerTrial);
    expect(recorded.trials[0]?.trace.at(0)?.x).toBe(0);
    expect(recorded.trials[0]?.trace.at(-1)?.x).toBe(999);
  });

  it("uses the supplied reader for the initial active lesson", () => {
    const rhythmLesson = testCurriculum.lessonById("rhythm-meter", "cycles-and-euclidean-rhythm");
    if (!rhythmLesson) throw new Error("Missing synthetic rhythm lesson.");

    const curriculum = { ...testCurriculum, defaultLesson: rhythmLesson };

    expect(createPortfolio(curriculum).active).toEqual({ labId: "rhythm-meter", lessonId: "cycles-and-euclidean-rhythm" });
  });

  it("advances an immutably updated prediction regardless of property insertion order", () => {
    const attempt = createAttemptV2(
      testCurriculum,
      "phase-proportion",
      "from-bpm-to-period",
      "2026-08-28T10:00:00.000Z",
    );
    const predicted = setAttemptPrediction(
      attempt,
      "The period halves.",
      "2026-08-28T10:01:00.000Z",
    );

    expect(advanceAttempt(predicted, "experiment", "2026-08-28T10:02:00.000Z").stage)
      .toBe("experiment");
  });

  it("normalizes oversized new responses while preserving inquiry progression", () => {
    const oversized = "🎼".repeat(maximumResponseCodePoints + 1);
    const orient = createAttemptV2(
      testCurriculum,
      "phase-proportion",
      "from-bpm-to-period",
      "2026-08-28T10:00:00.000Z",
    );
    const predicted = setAttemptPrediction(orient, oversized);
    const experiment = advanceAttempt(predicted, "experiment");
    const oneTrial = recordTrial(testCurriculum, experiment, trial("Run A"));
    const twoTrials = recordTrial(testCurriculum, oneTrial, trial("Run B"));
    const compare = advanceAttempt(twoTrials, "compare");
    const explain = advanceAttempt(compare, "explain");
    const explained = setAttemptResponse(explain, "explanation", oversized);
    const updated = updateAttempt(testCurriculum, createPortfolio(testCurriculum), explained);
    const stored = activeAttempt(testCurriculum, updated);

    expect(Array.from(stored.prediction ?? "")).toHaveLength(maximumResponseCodePoints);
    expect(Array.from(stored.explanation ?? "")).toHaveLength(maximumResponseCodePoints);
    expect(advanceAttempt(stored, "perform").stage).toBe("perform");
  });
});

describe("recorded run trimming notice", () => {
  const attempt = {
    ...createAttemptV2(testCurriculum, "phase-proportion", "from-bpm-to-period", "2026-08-28T10:00:00.000Z"),
    stage: "experiment" as const,
    prediction: "The period halves.",
    trials: [trial("Run A"), trial("Run B")],
  };
  const submittedTrial = trial("Run 3");

  it("does not report an unchanged accepted run", () => {
    const next = recordTrial(testCurriculum, attempt, submittedTrial);
    expect(next).not.toBe(attempt);
    expect(recordedRunWasTrimmed(attempt, submittedTrial, next)).toBe(false);
  });

  it("reports a shortened Unicode note", () => {
    const submitted = { ...submittedTrial, note: "🎼".repeat(16_385) };
    const next = recordTrial(testCurriculum, attempt, submitted);
    expect(recordedRunWasTrimmed(attempt, submitted, next)).toBe(true);
  });

  it("reports removal of the oldest run when recording a thirteenth", () => {
    const previous = { ...attempt, trials: Array.from({ length: 12 }, (_, i) => trial(`Run ${i + 1}`)) };
    const submitted = trial("Run 13");
    const next = recordTrial(testCurriculum, previous, submitted);
    expect(next.trials).toHaveLength(12);
    expect(recordedRunWasTrimmed(previous, submitted, next)).toBe(true);
  });

  it("reports reduced trace data", () => {
    const submitted = trial("Run 3", Array.from({ length: 300 }, (_, x) => ({ x, y: x, series: "test" })));
    const next = recordTrial(testCurriculum, attempt, submitted);
    expect(next.trials.at(-1)?.trace).toHaveLength(256);
    expect(recordedRunWasTrimmed(attempt, submitted, next)).toBe(true);
  });
});

describe("trial snapshots", () => {
  const lesson = testCurriculum.defaultLesson;
  const evaluation = {
    observables: [{ id: "period", label: "Period", value: 0.5, unit: "s", aggregation: "instantaneous", claimId: "math.identity" }],
    trace: [{ x: 0, y: 1, series: "test" }],
    provenance: { source: "model", calibration: "uncalibrated", method: "test" },
  } as unknown as EvaluationOutput;
  const factors = { bpm: 120, beatsPerBar: 4 };
  const recordedAt = "2026-08-28T10:00:00.000Z";

  it("labels the first runs A and B, then by position", () => {
    expect([0, 1, 2, 5].map(runLabel)).toEqual(["Run A", "Run B", "Run 3", "Run 6"]);
  });

  it("copies evaluation data and trims the note", () => {
    const snapshot = createTrialSnapshot({ lesson, runIndex: 1, factors, evaluation, note: "  steady  ", recordedAt });
    expect(snapshot).toEqual({
      id: "Run B",
      labId: "phase-proportion",
      lessonId: "from-bpm-to-period",
      protocolId: "phase-proportion.from-bpm-to-period.v1",
      deterministic: true,
      recordedAt,
      factors,
      observables: evaluation.observables,
      trace: evaluation.trace,
      provenance: evaluation.provenance,
      note: "steady",
    });
    expect(snapshot.factors).not.toBe(factors);
    expect(snapshot.observables[0]).not.toBe(evaluation.observables[0]);
  });

  it("omits an empty note and is not deterministic for recorded audio", () => {
    const recorded = { ...evaluation, provenance: { ...evaluation.provenance, source: "file" } } as EvaluationOutput;
    const snapshot = createTrialSnapshot({ lesson, runIndex: 0, factors, evaluation: recorded, note: "  ", recordedAt });
    expect(snapshot.deterministic).toBe(false);
    expect(snapshot).not.toHaveProperty("note");
    expect(snapshot).not.toHaveProperty("seed");
  });

  it("seeds deterministic runs from the protocol seed", () => {
    const seeded = { ...lesson, protocol: { ...lesson.protocol, seed: "factor:bpm" } };
    expect(createTrialSnapshot({ lesson: seeded, runIndex: 0, factors, evaluation, note: "", recordedAt }).seed).toBe("120");
  });
});

function trial(id: string, trace: TrialSnapshotV2["trace"] = []): TrialSnapshotV2 {
  return {
    id,
    labId: "phase-proportion",
    lessonId: "from-bpm-to-period",
    protocolId: "phase-proportion.from-bpm-to-period.v1",
    deterministic: true,
    recordedAt: "2026-08-28T10:00:00.000Z",
    factors: { bpm: 120, beatsPerBar: 4 },
    observables: [{ id: "period", label: "Period", value: 0.5, unit: "s", aggregation: "instantaneous", claimId: "math.identity" }],
    trace,
    provenance: { source: "model", calibration: "uncalibrated", method: "test" },
  };
}
