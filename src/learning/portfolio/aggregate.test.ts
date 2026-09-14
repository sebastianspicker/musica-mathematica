import { describe, expect, it } from "vitest";
import type { TrialSnapshotV2 } from "./schema-v2";
import {
  activeAttempt,
  advanceAttempt,
  createAttemptV2,
  createPortfolio,
  recordTrial,
  setAttemptPrediction,
  setAttemptResponse,
  updateAttempt,
} from "./aggregate";
import { maximumResponseCodePoints, maximumTracePointsPerTrial } from "./constants";
import { testCurriculum } from "./testReader";

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
