import { describe, expect, it } from "vitest";
import {
  isLearningPortfolioV2,
  isLessonAttemptV2,
  isTrialSnapshotV2,
  normalizePortfolio,
  sanitizePortfolio,
  sanitizeTrial,
} from "./validate";
import {
  maximumExtensionFactorCodePoints,
  maximumLabelCodePoints,
  maximumLongValueCodePoints,
  maximumObservablesPerTrial,
  maximumResponseCodePoints,
} from "./schema";
import { testCurriculum } from "./curriculumFixture.test-helper";

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
      protocolId: "phase-proportion.from-bpm-to-period.v1",
      factors: { bpm: 120, beatsPerBar: 4, extension: true, discarded: Number.NaN },
      trace: Array.from({ length: 300 }, (_, x) => ({ x, y: x, series: "period" })),
      provenance: { ...validTrial().provenance, calibration: "calibrated" },
      note: "  recorded locally  ",
    } as unknown as Parameters<typeof sanitizeTrial>[0];

    const cleaned = sanitizeTrial(trial, testCurriculum);

    expect(cleaned).toMatchObject({
      id: "Run A",
      protocolId: "phase-proportion.from-bpm-to-period.v1",
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
    const key = "phase-proportion:from-bpm-to-period";
    expect(cleaned.attempts).toHaveProperty(key);
    expect(cleaned.attempts).not.toHaveProperty("invalid");
    expect(cleaned.attempts[key]).toMatchObject({ prediction: "a prediction", trials: attempt.trials });
    expect(cleaned.attempts[key]).not.toHaveProperty("explanation");
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

  it("normalizes Unicode caps, factor order, and bounded optional collections", () => {
    const emoji = "🎼";
    const extensions = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [
      `extension-${String(index).padStart(2, "0")}`,
      index === 0 ? emoji.repeat(maximumExtensionFactorCodePoints + 1) : index,
    ]));
    const trial = {
      ...validTrial(),
      seed: "x".repeat(maximumExtensionFactorCodePoints + 1),
      factors: {
        zExtension: true,
        beatsPerBar: 4,
        ...extensions,
        bpm: 120,
        AExtension: "kept",
        ["x".repeat(maximumExtensionFactorCodePoints + 1)]: "discarded",
      },
      observables: Array.from({ length: maximumObservablesPerTrial + 6 }, (_, index) => ({
        ...validTrial().observables[0],
        id: `observable-${index}`,
        label: emoji.repeat(maximumLabelCodePoints + 1),
        value: emoji.repeat(maximumLongValueCodePoints + 1),
        precision: index === 0 ? 101 : 2,
      })),
      trace: Array.from({ length: 300 }, (_, x) => ({
        x,
        y: x,
        series: emoji.repeat(maximumLabelCodePoints + 1),
      })),
      provenance: {
        ...validTrial().provenance,
        method: emoji.repeat(maximumLongValueCodePoints + 1),
        sampleRateHz: Number.NaN,
      },
      note: emoji.repeat(maximumResponseCodePoints + 1),
    } as unknown as Parameters<typeof sanitizeTrial>[0];

    const cleaned = sanitizeTrial(trial, testCurriculum);
    const factorKeys = Object.keys(cleaned.factors);

    expect(factorKeys.slice(0, 2)).toEqual(["bpm", "beatsPerBar"]);
    expect(factorKeys).toHaveLength(16);
    expect(factorKeys.slice(2)).toEqual([...factorKeys.slice(2)].sort());
    expect(Array.from(String(cleaned.factors["extension-00"]))).toHaveLength(
      maximumExtensionFactorCodePoints,
    );
    expect(cleaned).not.toHaveProperty("seed");
    expect(cleaned.observables).toHaveLength(maximumObservablesPerTrial);
    expect(cleaned.observables[0]).not.toHaveProperty("precision");
    expect(Array.from(cleaned.observables[0]?.label ?? "")).toHaveLength(maximumLabelCodePoints);
    expect(Array.from(String(cleaned.observables[0]?.value))).toHaveLength(maximumLongValueCodePoints);
    expect(cleaned.trace).toHaveLength(256);
    expect(cleaned.trace[0]?.x).toBe(0);
    expect(cleaned.trace.at(-1)?.x).toBe(299);
    expect(cleaned.provenance).not.toHaveProperty("sampleRateHz");
    expect(Array.from(cleaned.provenance.method)).toHaveLength(maximumLongValueCodePoints);
    expect(Array.from(cleaned.note ?? "")).toHaveLength(maximumResponseCodePoints);
    expect(cleaned.protocolId).toBe(validTrial().protocolId);
    expect(cleaned.observables[0]?.claimId).toBe("math.identity");
  });

  it("validates documented objects independently of property insertion order", () => {
    const trial = validTrial();
    const reordered = {
      provenance: trial.provenance,
      trace: trial.trace,
      observables: trial.observables,
      factors: trial.factors,
      recordedAt: trial.recordedAt,
      deterministic: trial.deterministic,
      protocolId: trial.protocolId,
      lessonId: trial.lessonId,
      labId: trial.labId,
      id: trial.id,
    };

    expect(isTrialSnapshotV2(reordered, testCurriculum)).toBe(true);
  });

  it("refuses normalization that would silently discard the active attempt", () => {
    const attempt = { ...validAttempt(), stage: "compare" as const };
    const portfolio = {
      version: 2,
      active: { labId: attempt.labId, lessonId: attempt.lessonId },
      attempts: { active: attempt },
    };

    expect(normalizePortfolio(portfolio, testCurriculum)).toBeUndefined();
  });

  it("keeps the newest twelve trials in chronological order", () => {
    const trials = Array.from({ length: 14 }, (_, index) => ({
      ...validTrial(),
      id: `Run ${index}`,
      recordedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    })).reverse();
    const attempt = { ...validAttempt(), trials };
    const portfolio = {
      version: 2,
      active: { labId: attempt.labId, lessonId: attempt.lessonId },
      attempts: { active: attempt },
    };

    const normalized = normalizePortfolio(portfolio, testCurriculum);
    const retained = normalized?.attempts["phase-proportion:from-bpm-to-period"]?.trials;

    expect(retained).toHaveLength(12);
    expect(retained?.[0]?.id).toBe("Run 2");
    expect(retained?.at(-1)?.id).toBe("Run 13");
  });
});
