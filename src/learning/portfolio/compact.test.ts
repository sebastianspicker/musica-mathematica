import { describe, expect, it } from "vitest";
import type {
  CurriculumLessonReader,
  LessonDefinition,
} from "../../curriculum/contracts";
import { lessonStages } from "../stages";
import { preparePortfolio } from "./compact";
import {
  attemptKey,
  maximumPortfolioJsonBytes,
} from "./constants";
import type {
  LearningPortfolioV2,
  LessonAttemptV2,
  TrialSnapshotV2,
} from "./schema-v2";

describe("portfolio byte compaction", () => {
  it("reduces traces and oldest excess trials while preserving comparison trials", () => {
    const curriculum = curriculumWithLessons(8);
    const attempts = Object.fromEntries(Array.from({ length: 8 }, (_, index) => {
      const lessonId = `lesson-${index}`;
      const stage = index === 0 ? "compare" as const : "experiment" as const;
      const attempt = attemptFor(lessonId, stage, 12, true, index);
      return [attemptKey("phase-proportion", lessonId), attempt];
    }));
    const portfolio: LearningPortfolioV2 = {
      version: 2,
      active: { labId: "phase-proportion", lessonId: "lesson-0" },
      attempts,
    };

    const prepared = preparePortfolio(portfolio, curriculum);
    const active = prepared.portfolio?.attempts["phase-proportion:lesson-0"];

    expect(prepared.normalizationStatus).toBe("compacted");
    expect(prepared.byteLength).toBeLessThanOrEqual(maximumPortfolioJsonBytes);
    expect(active).toBeDefined();
    expect(active?.trials.length).toBeGreaterThanOrEqual(2);
    expect(Object.values(prepared.portfolio?.attempts ?? {}).some(
      (attempt) => attempt.trials.length < 12,
    )).toBe(true);
    expect(Object.values(prepared.portfolio?.attempts ?? {}).every(
      (attempt) => attempt.trials.every((trial) => trial.trace.length === 0),
    )).toBe(true);
  }, 30_000);

  it("removes the oldest nonactive attempts only after required content is protected", () => {
    const curriculum = curriculumWithLessons(72);
    const attempts = Object.fromEntries(Array.from({ length: 72 }, (_, index) => {
      const lessonId = `lesson-${index}`;
      const attempt = attemptFor(lessonId, "debrief", 2, false, index);
      return [attemptKey("phase-proportion", lessonId), attempt];
    }));
    const portfolio: LearningPortfolioV2 = {
      version: 2,
      active: { labId: "phase-proportion", lessonId: "lesson-0" },
      attempts,
    };

    const prepared = preparePortfolio(portfolio, curriculum);

    expect(prepared.normalizationStatus).toBe("compacted");
    expect(prepared.byteLength).toBeLessThanOrEqual(maximumPortfolioJsonBytes);
    expect(prepared.portfolio?.attempts).toHaveProperty("phase-proportion:lesson-0");
    expect(prepared.portfolio?.attempts["phase-proportion:lesson-0"]?.trials).toHaveLength(2);
    expect(Object.keys(prepared.portfolio?.attempts ?? {}).length).toBeLessThan(72);
    expect(prepared.portfolio?.attempts).not.toHaveProperty("phase-proportion:lesson-1");
  }, 30_000);
});

function curriculumWithLessons(count: number): CurriculumLessonReader {
  const lessons = Array.from({ length: count }, (_, index) => lesson(`lesson-${index}`));
  return {
    defaultLesson: lessons[0]!,
    lessonById: (domainId, lessonId) => domainId === "phase-proportion"
      ? lessons.find((candidate) => candidate.id === lessonId)
      : undefined,
  };
}

function lesson(id: string): LessonDefinition {
  return {
    id,
    domainId: "phase-proportion",
    number: 1,
    level: "foundation",
    title: id,
    shortTitle: id,
    question: "Question",
    objective: "Objective",
    equation: "x = 1",
    equationCaption: "Caption",
    predictionPrompt: "Predict",
    experimentPrompt: "Experiment",
    interpretationPrompt: "Interpret",
    transferPrompt: "Transfer",
    factors: [{
      id: "factor",
      kind: "number",
      label: "Factor",
      min: 0,
      max: 2,
      step: 1,
      defaultValue: 1,
      help: "Factor",
    }],
    claimIds: ["model.deterministic"],
    sourceIds: [],
    protocol: { id: `phase-proportion.${id}.v1`, deterministic: true, durationSeconds: 1 },
    inputModes: ["synthetic"],
  };
}

function attemptFor(
  lessonId: string,
  stage: LessonAttemptV2["stage"],
  trialCount: number,
  largeTrials: boolean,
  offset: number,
): LessonAttemptV2 {
  const response = "r".repeat(16_384);
  return {
    version: 2,
    labId: "phase-proportion",
    lessonId,
    stage,
    prediction: response,
    ...(lessonStages.indexOf(stage) >= lessonStages.indexOf("perform")
      ? { explanation: response }
      : {}),
    ...(lessonStages.indexOf(stage) >= lessonStages.indexOf("transfer")
      ? { performanceReflection: response }
      : {}),
    ...(stage === "debrief" ? { transferResponse: response } : {}),
    trials: Array.from({ length: trialCount }, (_, index) =>
      trialFor(lessonId, index, largeTrials)),
    updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, offset)).toISOString(),
  };
}

function trialFor(lessonId: string, index: number, large: boolean): TrialSnapshotV2 {
  const repeat = (value: string, count: number): string => large ? value.repeat(count) : value;
  return {
    id: `Run ${index}`,
    labId: "phase-proportion",
    lessonId,
    protocolId: `phase-proportion.${lessonId}.v1`,
    deterministic: true,
    recordedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    factors: { factor: 1 },
    observables: Array.from({ length: large ? 24 : 1 }, (_, observableIndex) => ({
      id: `observable-${observableIndex}`,
      label: repeat("l", 256),
      value: repeat("v", 1_024),
      unit: repeat("u", 256),
      aggregation: "instantaneous" as const,
      claimId: "model.deterministic",
    })),
    trace: Array.from({ length: large ? 256 : 0 }, (_, pointIndex) => ({
      x: pointIndex,
      y: pointIndex,
      series: repeat("s", 256),
    })),
    provenance: {
      source: "model",
      calibration: "uncalibrated",
      method: repeat("m", 1_024),
    },
    note: repeat("n", 16_384),
  };
}
