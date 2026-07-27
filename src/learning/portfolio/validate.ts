import { labLessonById } from "../../labs/catalog";
import {
  labIds,
  type FactorDefinition,
  type FactorValue,
  type LabId,
  type ObservableRecord,
  type TracePoint,
  type TrialSnapshotV2,
} from "../../labs/types";
import { isLessonStage, lessonStages } from "../lessonAttempt";
import {
  attemptKey,
  maximumTrialsPerLesson,
  maximumTracePointsPerTrial,
} from "./constants";
import type { LearningPortfolioV2, LessonAttemptV2 } from "./types";

export function isLearningPortfolioV2(value: unknown): value is LearningPortfolioV2 {
  if (!isRecord(value) || value.version !== 2 || !isActive(value.active) || !isRecord(value.attempts)) return false;
  const entries = Object.entries(value.attempts);
  if (!entries.every(([key, attempt]) => isLessonAttemptV2(attempt) && key === attemptKey(attempt.labId, attempt.lessonId))) return false;
  return labLessonById(value.active.labId, value.active.lessonId) !== undefined;
}

export function isLessonAttemptV2(value: unknown): value is LessonAttemptV2 {
  if (!isLessonAttemptV2Shape(value)) return false;
  return hasRequiredStageContent(value);
}

export function isTrialSnapshotV2(value: unknown): value is TrialSnapshotV2 {
  if (!isRecord(value)) return false;
  return hasTrialIdentity(value)
    && hasTrialProtocol(value)
    && hasTrialFactors(value)
    && hasTrialMeasurements(value)
    && hasOptionalTrialMetadata(value);
}

export function sanitizePortfolio(portfolio: LearningPortfolioV2): LearningPortfolioV2 {
  const attempts = Object.fromEntries(Object.entries(portfolio.attempts).flatMap(([key, attempt]) => {
    if (!isLessonAttemptShape(attempt)) return [];
    const cleaned: LessonAttemptV2 = {
      version: 2,
      labId: attempt.labId,
      lessonId: attempt.lessonId,
      stage: attempt.stage,
      ...(hasText(attempt.prediction) ? { prediction: attempt.prediction.trim() } : {}),
      ...(hasText(attempt.explanation) ? { explanation: attempt.explanation.trim() } : {}),
      ...(hasText(attempt.performanceReflection) ? { performanceReflection: attempt.performanceReflection.trim() } : {}),
      ...(hasText(attempt.transferResponse) ? { transferResponse: attempt.transferResponse.trim() } : {}),
      trials: attempt.trials.slice(-maximumTrialsPerLesson).map(sanitizeTrial),
      updatedAt: attempt.updatedAt,
    };
    return [[key, cleaned]];
  }));
  return { version: 2, active: { ...portfolio.active }, attempts };
}

export function sanitizeTrial(trial: TrialSnapshotV2): TrialSnapshotV2 {
  return {
    id: trial.id.trim(),
    labId: trial.labId,
    lessonId: trial.lessonId,
    protocolId: trial.protocolId.trim(),
    deterministic: trial.deterministic,
    ...(trial.seed ? { seed: trial.seed } : {}),
    recordedAt: trial.recordedAt,
    factors: sanitizeFactors(trial.factors),
    observables: trial.observables.map((item) => ({ ...item })),
    trace: capTrace(trial.trace),
    provenance: {
      source: trial.provenance.source,
      calibration: "uncalibrated",
      method: trial.provenance.method,
      ...(trial.provenance.sampleRateHz !== undefined ? { sampleRateHz: trial.provenance.sampleRateHz } : {}),
      ...(trial.provenance.frameSize !== undefined ? { frameSize: trial.provenance.frameSize } : {}),
      ...(trial.provenance.hopSize !== undefined ? { hopSize: trial.provenance.hopSize } : {}),
      ...(trial.provenance.droppedFrames !== undefined ? { droppedFrames: trial.provenance.droppedFrames } : {}),
    },
    ...(trial.note?.trim() ? { note: trial.note.trim() } : {}),
  };
}

function sanitizeFactors(factors: TrialSnapshotV2["factors"]): Record<string, FactorValue> {
  const sanitized: [string, FactorValue][] = [];
  for (const [id, value] of Object.entries(factors)) {
    if (isFactorValue(value)) sanitized.push([id, value]);
  }
  return Object.fromEntries(sanitized);
}

function capTrace(trace: readonly TracePoint[]): TracePoint[] {
  if (trace.length <= maximumTracePointsPerTrial) return trace.map((point) => ({ ...point }));
  return Array.from({ length: maximumTracePointsPerTrial }, (_, index) => {
    const sourceIndex = Math.round(index * (trace.length - 1) / (maximumTracePointsPerTrial - 1));
    return { ...trace[sourceIndex] };
  });
}

const hasTrialIdentity = (value: Record<string, unknown>): boolean => {
  return typeof value.id === "string"
    && value.id.trim().length > 0
    && isLabId(value.labId)
    && typeof value.lessonId === "string"
    && labLessonById(value.labId, value.lessonId) !== undefined;
};

const hasTrialProtocol = (value: Record<string, unknown>): boolean => {
  return typeof value.protocolId === "string"
    && value.protocolId.trim().length > 0
    && typeof value.deterministic === "boolean"
    && typeof value.recordedAt === "string"
    && isIsoTimestamp(value.recordedAt);
};

const hasTrialFactors = (value: Record<string, unknown>): boolean => {
  if (!isRecord(value.factors) || !isLabId(value.labId) || typeof value.lessonId !== "string") return false;
  const factors = value.factors;
  const lesson = labLessonById(value.labId, value.lessonId);
  if (!lesson) return false;
  const knownFactorsArePresent = lesson.factors.every((definition) => {
    if (!Object.prototype.hasOwnProperty.call(factors, definition.id)) return false;
    const factorValue = factors[definition.id];
    return isFactorValue(factorValue) && isFactorValueForDefinition(factorValue, definition);
  });
  if (!knownFactorsArePresent) return false;
  return Object.entries(factors).every(([id, factorValue]) => {
    if (!isFactorValue(factorValue)) return false;
    const definition = lesson.factors.find((factor) => factor.id === id);
    return definition === undefined || isFactorValueForDefinition(factorValue, definition);
  });
};

const hasTrialMeasurements = (value: Record<string, unknown>): boolean => {
  return hasObservableRecords(value)
    && hasTracePoints(value)
    && isProvenance(value.provenance);
};

const hasObservableRecords = (value: Record<string, unknown>): boolean => {
  return Array.isArray(value.observables) && value.observables.every(isObservable);
};

const hasTracePoints = (value: Record<string, unknown>): boolean => {
  return Array.isArray(value.trace)
    && value.trace.length <= maximumTracePointsPerTrial
    && value.trace.every(isTracePoint);
};

const hasOptionalTrialMetadata = (value: Record<string, unknown>): boolean => {
  return (value.seed === undefined || typeof value.seed === "string")
    && (value.note === undefined || typeof value.note === "string");
};

const isLessonAttemptShape = (value: unknown): value is LessonAttemptV2 => {
  return isRecord(value) && value.version === 2 && isLabId(value.labId) && typeof value.lessonId === "string" &&
    isLessonStage(value.stage) && Array.isArray(value.trials) && typeof value.updatedAt === "string";
};

const isLessonAttemptV2Shape = (value: unknown): value is LessonAttemptV2 => {
  if (!isRecord(value)) return false;
  return hasAttemptV2Metadata(value)
    && hasAttemptV2Trials(value)
    && hasOptionalAttemptResponses(value);
};

const hasAttemptV2Metadata = (value: Record<string, unknown>): boolean => {
  return value.version === 2
    && isLabId(value.labId)
    && typeof value.lessonId === "string"
    && labLessonById(value.labId, value.lessonId) !== undefined
    && isLessonStage(value.stage)
    && typeof value.updatedAt === "string"
    && isIsoTimestamp(value.updatedAt);
};

const hasAttemptV2Trials = (value: Record<string, unknown>): boolean => {
  if (!Array.isArray(value.trials) || value.trials.length > maximumTrialsPerLesson) return false;
  return value.trials.every((trial) => isTrialSnapshotV2(trial)
    && trial.labId === value.labId
    && trial.lessonId === value.lessonId);
};

const hasOptionalAttemptResponses = (value: Record<string, unknown>): boolean => {
  return [value.prediction, value.explanation, value.performanceReflection, value.transferResponse].every(isOptionalText);
};

const hasRequiredStageContent = (attempt: LessonAttemptV2): boolean => {
  const index = lessonStages.indexOf(attempt.stage);
  return hasPredictionForStage(attempt, index)
    && hasTrialsForStage(attempt, index)
    && hasExplanationForStage(attempt, index)
    && hasPerformanceReflectionForStage(attempt, index)
    && hasTransferResponseForStage(attempt, index);
};

const hasPredictionForStage = (attempt: LessonAttemptV2, index: number): boolean => {
  return index < lessonStages.indexOf("experiment") || hasText(attempt.prediction);
};

const hasTrialsForStage = (attempt: LessonAttemptV2, index: number): boolean => {
  return index < lessonStages.indexOf("compare") || attempt.trials.length >= 2;
};

const hasExplanationForStage = (attempt: LessonAttemptV2, index: number): boolean => {
  return index < lessonStages.indexOf("perform") || hasText(attempt.explanation);
};

const hasPerformanceReflectionForStage = (attempt: LessonAttemptV2, index: number): boolean => {
  return index < lessonStages.indexOf("transfer") || hasText(attempt.performanceReflection);
};

const hasTransferResponseForStage = (attempt: LessonAttemptV2, index: number): boolean => {
  return index < lessonStages.indexOf("debrief") || hasText(attempt.transferResponse);
};

const isActive = (value: unknown): value is LearningPortfolioV2["active"] => {
  return isRecord(value) && isLabId(value.labId) && typeof value.lessonId === "string";
};

const isLabId = (value: unknown): value is LabId => {
  return typeof value === "string" && (labIds as readonly string[]).includes(value);
};

const isObservable = (value: unknown): value is ObservableRecord => {
  return isRecord(value) && typeof value.id === "string" && typeof value.label === "string" &&
    (typeof value.value === "string" || (typeof value.value === "number" && Number.isFinite(value.value))) &&
    (value.unit === null || typeof value.unit === "string") && typeof value.claimId === "string" &&
    ["instantaneous", "terminal-mean", "range", "distribution"].includes(String(value.aggregation)) &&
    (value.precision === undefined || (typeof value.precision === "number" &&
      Number.isInteger(value.precision) && value.precision >= 0 && value.precision <= 100));
};

const isTracePoint = (value: unknown): value is TracePoint => {
  return isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y) && typeof value.series === "string";
};

const isProvenance = (value: unknown): value is TrialSnapshotV2["provenance"] => {
  return isRecord(value) && ["model", "synthetic", "microphone", "file"].includes(String(value.source)) &&
    value.calibration === "uncalibrated" && typeof value.method === "string" &&
    [value.sampleRateHz, value.frameSize, value.hopSize, value.droppedFrames].every((item) => item === undefined || (typeof item === "number" && Number.isFinite(item)));
};

const isFactorValue = (value: unknown): value is FactorValue => {
  return typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));
};

const isFactorValueForDefinition = (value: FactorValue, definition: FactorDefinition): boolean => {
  if (definition.kind === "number") {
    return typeof value === "number" && value >= definition.min && value <= definition.max;
  }
  if (definition.kind === "select") {
    return typeof value === "string" && definition.options.some((option) => option.value === value);
  }
  return typeof value === "boolean";
};

const isOptionalText = (value: unknown): boolean => {
  return value === undefined || hasText(value);
};

const hasText = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const isIsoTimestamp = (value: string): boolean => {
  return Number.isFinite(Date.parse(value));
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};
