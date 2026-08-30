import { describe, expect, it } from "vitest";
import {
  isLearningPortfolioV2,
  isLessonAttemptV2,
  isTrialSnapshotV2,
  sanitizePortfolio,
  sanitizeTrial,
} from "./validate";
import { testCurriculum } from "./testReader";

const recordedAt = "2026-08-06T10:00:00.000Z";

const validTrial = () => ({
  id: "Run A",
  labId: "phase-proportion" as const,
  lessonId: "from-bpm-to-period",
  protocolId: "phase-proportion.from-bpm-to-period.v1",
  deterministic: true,
  recordedAt,
  factors: { bpm: 120, beatsPerBar: 4 },
  observables: [{
    id: "period",
    label: "Period",
    value: 0.5,
    unit: "s",
    aggregation: "instantaneous" as const,
    claimId: "math.identity",
  }],
  trace: [{ x: 0, y: 0.5, series: "period" }],
  provenance: { source: "model" as const, calibration: "uncalibrated" as const, method: "test" },
});

const validAttempt = () => ({
  version: 2 as const,
  labId: "phase-proportion" as const,
  lessonId: "from-bpm-to-period",
  stage: "experiment" as const,
  prediction: "The period halves.",
  trials: [validTrial()],
  updatedAt: recordedAt,
});

describe("portfolio validation", () => {
  it("validates catalog-conforming trials while retaining unknown valid factors", () => {
    const trial = { ...validTrial(), factors: { bpm: 120, beatsPerBar: 4, retainedExtension: "local" } };

    expect(isTrialSnapshotV2(trial, testCurriculum)).toBe(true);
    expect(isTrialSnapshotV2({ ...trial, factors: { bpm: 120 } }, testCurriculum)).toBe(false);
    expect(isTrialSnapshotV2({ ...trial, factors: { bpm: "fast", beatsPerBar: 4 } }, testCurriculum)).toBe(false);
    expect(isTrialSnapshotV2({ ...trial, observables: [{ ...trial.observables[0], value: Number.NaN }] }, testCurriculum)).toBe(false);
    expect(isTrialSnapshotV2({ ...trial, provenance: { ...trial.provenance, sampleRateHz: Number.POSITIVE_INFINITY } }, testCurriculum)).toBe(false);
  });

  it("enforces attempt stage content, bounded trials, and matching portfolio keys", () => {
    const attempt = validAttempt();
    const portfolio = {
      version: 2 as const,
      active: { labId: "phase-proportion" as const, lessonId: "from-bpm-to-period" },
      attempts: { "phase-proportion:from-bpm-to-period": attempt },
    };

    expect(isLessonAttemptV2(attempt, testCurriculum)).toBe(true);
    expect(isLessonAttemptV2({ ...attempt, stage: "compare" as const }, testCurriculum)).toBe(false);
    expect(isLessonAttemptV2({ ...attempt, trials: Array.from({ length: 13 }, validTrial) }, testCurriculum)).toBe(false);
    expect(isLearningPortfolioV2(portfolio, testCurriculum)).toBe(true);
    expect(isLearningPortfolioV2({ ...portfolio, attempts: { wrong: attempt } }, testCurriculum)).toBe(false);
  });

  it("sanitizes text, factor values, provenance, and oversized traces without mutating the source", () => {
    const trial = {
      ...validTrial(),
      id: " Run A ",
      protocolId: " protocol ",
      factors: { bpm: 120, beatsPerBar: 4, extension: true, discarded: Number.NaN },
      trace: Array.from({ length: 300 }, (_, x) => ({ x, y: x, series: "period" })),
      provenance: { ...validTrial().provenance, calibration: "calibrated" },
      note: "  recorded locally  ",
    } as unknown as Parameters<typeof sanitizeTrial>[0];

    const cleaned = sanitizeTrial(trial);

    expect(cleaned).toMatchObject({
      id: "Run A",
      protocolId: "protocol",
      factors: { bpm: 120, beatsPerBar: 4, extension: true },
      provenance: { calibration: "uncalibrated" },
      note: "recorded locally",
    });
    expect(cleaned.trace).toHaveLength(256);
    expect(cleaned.trace.at(0)?.x).toBe(0);
    expect(cleaned.trace.at(-1)?.x).toBe(299);
    expect(trial.trace).toHaveLength(300);
  });

  it("retains only attempt-shaped records when sanitizing a portfolio", () => {
    const attempt = { ...validAttempt(), prediction: "  a prediction  ", explanation: "   " };
    const portfolio = {
      version: 2 as const,
      active: { labId: "phase-proportion" as const, lessonId: "from-bpm-to-period" },
      attempts: {
        valid: attempt,
        invalid: { ...attempt, trials: "not an array" },
      },
    };

    const cleaned = sanitizePortfolio(portfolio as unknown as Parameters<typeof sanitizePortfolio>[0], testCurriculum);

    expect(cleaned.version).toBe(2);
    expect(cleaned.active).toEqual(portfolio.active);
    expect(cleaned.attempts).toHaveProperty("valid");
    expect(cleaned.attempts).not.toHaveProperty("invalid");
    expect(cleaned.attempts.valid).toMatchObject({ prediction: "a prediction", trials: attempt.trials });
    expect(cleaned.attempts.valid).not.toHaveProperty("explanation");
  });

  it("accepts only lessons supplied by the injected curriculum reader", () => {
    const trial = { ...validTrial(), labId: "rhythm-meter" as const, lessonId: "not-in-reader" };
    const portfolio = {
      version: 2 as const,
      active: { labId: "rhythm-meter" as const, lessonId: "not-in-reader" },
      attempts: {},
    };

    expect(isTrialSnapshotV2(trial, testCurriculum)).toBe(false);
    expect(isLearningPortfolioV2(portfolio, testCurriculum)).toBe(false);
  });
});
