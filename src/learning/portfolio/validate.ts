import type {
  CurriculumDomainId,
  CurriculumLessonReader,
  FactorDefinition,
  FactorValue,
  LessonDefinition,
  ObservableRecord,
  TracePoint,
} from "../../curriculum/contracts";
import { isLessonStage, lessonStages } from "../stages";
import {
  attemptKey,
  maximumExtensionFactorCodePoints,
  maximumExtensionFactorsPerTrial,
  maximumLabelCodePoints,
  maximumLongValueCodePoints,
  maximumObservablesPerTrial,
  maximumResponseCodePoints,
  maximumTracePointsPerTrial,
  maximumTrialsPerLesson,
  type LearningPortfolioV2,
  type LessonAttemptV2,
  type TrialSnapshotV2,
} from "./schema";

export function normalizePortfolio(
  value: unknown,
  curriculum: CurriculumLessonReader,
): LearningPortfolioV2 | undefined {
  if (!isRecord(value) || value.version !== 2 || !isRecord(value.active)) return undefined;
  const { labId, lessonId } = value.active;
  if (typeof lessonId !== "string" || !isKnownLesson(labId, lessonId, curriculum)
    || !isRecord(value.attempts)) return undefined;

  const attempts: Record<string, LessonAttemptV2> = {};
  let sawActiveCandidate = false;
  for (const candidate of Object.values(value.attempts)) {
    const attempt = normalizeAttempt(candidate, curriculum);
    if (isRecord(candidate) && candidate.labId === labId && candidate.lessonId === lessonId) {
      sawActiveCandidate = true;
    }
    if (attempt) attempts[attemptKey(attempt.labId, attempt.lessonId)] = attempt;
  }
  if (sawActiveCandidate && !attempts[attemptKey(labId, lessonId)]) return undefined;

  const normalized: LearningPortfolioV2 = {
    version: 2,
    active: { labId, lessonId },
    attempts,
  };
  return validatesNormalizedPortfolio(normalized, curriculum) ? normalized : undefined;
}

export function sanitizePortfolio(
  portfolio: LearningPortfolioV2,
  curriculum: CurriculumLessonReader,
): LearningPortfolioV2 {
  const normalized = normalizePortfolio(portfolio, curriculum);
  if (!normalized) throw new RangeError("Portfolio cannot be normalized to the version 2 schema.");
  return normalized;
}

export function sanitizeTrial(
  trial: TrialSnapshotV2,
  curriculum: CurriculumLessonReader,
): TrialSnapshotV2 {
  const normalized = normalizeTrial(trial, curriculum);
  if (!normalized) throw new RangeError("Trial cannot be normalized to the version 2 schema.");
  return normalized;
}

export function isLearningPortfolioV2(
  value: unknown,
  curriculum: CurriculumLessonReader,
): value is LearningPortfolioV2 {
  const normalized = normalizePortfolio(value, curriculum);
  return normalized !== undefined && sameJson(value, normalized);
}

export function isLessonAttemptV2(
  value: unknown,
  curriculum: CurriculumLessonReader,
): value is LessonAttemptV2 {
  const normalized = normalizeAttempt(value, curriculum);
  return normalized !== undefined && sameJson(value, normalized);
}

export function normalizeLessonAttempt(
  value: unknown,
  curriculum: CurriculumLessonReader,
): LessonAttemptV2 | undefined {
  return normalizeAttempt(value, curriculum);
}

export function isTrialSnapshotV2(
  value: unknown,
  curriculum: CurriculumLessonReader,
): value is TrialSnapshotV2 {
  const normalized = normalizeTrial(value, curriculum);
  return normalized !== undefined && sameJson(value, normalized);
}

export function capTrace(
  trace: readonly TracePoint[],
  maximumPoints = maximumTracePointsPerTrial,
): TracePoint[] {
  if (maximumPoints === 0) return [];
  if (trace.length <= maximumPoints) return trace.map((point) => ({ ...point }));
  if (maximumPoints === 1) return [{ ...trace[0]! }];
  return Array.from({ length: maximumPoints }, (_, index) => ({
    ...trace[Math.round(index * (trace.length - 1) / (maximumPoints - 1))]!,
  }));
}

function normalizeAttempt(
  value: unknown,
  curriculum: CurriculumLessonReader,
): LessonAttemptV2 | undefined {
  if (!isRecord(value) || value.version !== 2
    || typeof value.lessonId !== "string"
    || !isKnownLesson(value.labId, value.lessonId, curriculum)
    || !isLessonStage(value.stage) || !Array.isArray(value.trials)
    || typeof value.updatedAt !== "string" || !iso(value.updatedAt)) return undefined;

  const trials = value.trials.flatMap((trial, index) => {
    const normalized = normalizeTrial(trial, curriculum);
    if (!normalized || normalized.labId !== value.labId || normalized.lessonId !== value.lessonId) {
      return [];
    }
    return [{ trial: normalized, index }];
  }).sort((left, right) =>
    Date.parse(left.trial.recordedAt) - Date.parse(right.trial.recordedAt)
      || left.index - right.index,
  ).slice(-maximumTrialsPerLesson).map(({ trial }) => trial);

  const attempt: LessonAttemptV2 = {
    version: 2,
    labId: value.labId,
    lessonId: value.lessonId,
    stage: value.stage,
    ...optionalResponse("prediction", value.prediction),
    ...optionalResponse("explanation", value.explanation),
    ...optionalResponse("performanceReflection", value.performanceReflection),
    ...optionalResponse("transferResponse", value.transferResponse),
    trials,
    updatedAt: value.updatedAt.trim(),
  };
  return hasStageContent(attempt) ? attempt : undefined;
}

function normalizeTrial(
  value: unknown,
  curriculum: CurriculumLessonReader,
): TrialSnapshotV2 | undefined {
  if (!isRecord(value) || !text(value.id)
    || typeof value.lessonId !== "string"
    || !isKnownLesson(value.labId, value.lessonId, curriculum)
    || !text(value.protocolId) || typeof value.deterministic !== "boolean"
    || typeof value.recordedAt !== "string" || !iso(value.recordedAt)
    || !isRecord(value.factors) || !Array.isArray(value.observables)
    || !Array.isArray(value.trace) || !isRecord(value.provenance)) return undefined;
  const lesson = curriculum.lessonById(value.labId, value.lessonId);
  if (!lesson) return undefined;
  const canonicalProtocol = value.protocolId === lesson.protocol.id
    || value.protocolId === `${lesson.protocol.id}.legacy-v1`;
  if (value.protocolId !== value.protocolId.trim()
    || !canonicalProtocol && codePointLength(value.protocolId) > maximumExtensionFactorCodePoints) {
    return undefined;
  }
  const factors = normalizeFactors(value.factors, lesson);
  const provenance = normalizeProvenance(value.provenance);
  if (!factors || !provenance) return undefined;

  const observables = value.observables.flatMap((candidate) => {
    const observable = normalizeObservable(candidate, lesson);
    return observable ? [observable] : [];
  }).slice(0, maximumObservablesPerTrial);
  const trace = capTrace(value.trace.flatMap((candidate) => {
    const point = normalizeTracePoint(candidate);
    return point ? [point] : [];
  }));

  return {
    id: boundedText(value.id, maximumLabelCodePoints)!,
    labId: value.labId,
    lessonId: value.lessonId,
    protocolId: value.protocolId,
    deterministic: value.deterministic,
    ...optionalTrimmedCappedText("seed", value.seed),
    recordedAt: value.recordedAt.trim(),
    factors,
    observables,
    trace,
    provenance,
    ...optionalBoundedText("note", value.note, maximumResponseCodePoints),
  };
}

function normalizeFactors(
  factors: Record<string, unknown>,
  lesson: LessonDefinition,
): Record<string, FactorValue> | undefined {
  const normalized: Record<string, FactorValue> = {};
  const requiredIds = new Set(lesson.factors.map((factor) => factor.id));
  for (const definition of lesson.factors) {
    const value = factors[definition.id];
    if (!validFactor(value, definition)) return undefined;
    normalized[definition.id] = value;
  }
  if (lesson.factors.length > maximumExtensionFactorsPerTrial) return undefined;

  const extensions = Object.entries(factors).flatMap(([key, value]) => {
    if (requiredIds.has(key) || !isFactorValue(value)) return [];
    const normalizedKey = key.trim();
    if (key !== normalizedKey || !normalizedKey
      || codePointLength(normalizedKey) > maximumExtensionFactorCodePoints
      || requiredIds.has(normalizedKey)) return [];
    const normalizedValue = typeof value === "string"
      ? boundedText(value, maximumExtensionFactorCodePoints, true)
      : value;
    return normalizedValue === undefined ? [] : [{ key: normalizedKey, value: normalizedValue }];
  }).sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);

  for (const extension of extensions) {
    if (Object.keys(normalized).length >= maximumExtensionFactorsPerTrial) break;
    if (!(extension.key in normalized)) normalized[extension.key] = extension.value;
  }
  return normalized;
}

function normalizeObservable(
  value: unknown,
  lesson: LessonDefinition,
): ObservableRecord | undefined {
  if (!isRecord(value) || !text(value.id) || typeof value.label !== "string"
    || !observableValue(value.value) || !(value.unit === null || typeof value.unit === "string")
    || !text(value.claimId) || !aggregation(value.aggregation)) return undefined;
  const canonicalClaim = lesson.claimIds.includes(value.claimId);
  if (value.id !== value.id.trim() || value.claimId !== value.claimId.trim()
    || codePointLength(value.id) > maximumExtensionFactorCodePoints
    || !canonicalClaim && codePointLength(value.claimId) > maximumExtensionFactorCodePoints
    || typeof value.unit === "string" && codePointLength(value.unit) > maximumLabelCodePoints) {
    return undefined;
  }
  const label = boundedText(value.label, maximumLabelCodePoints, true);
  const observable = typeof value.value === "string"
    ? boundedText(value.value, maximumLongValueCodePoints, true)
    : value.value;
  if (label === undefined || observable === undefined) return undefined;

  return {
    id: value.id,
    label,
    value: observable,
    unit: value.unit,
    aggregation: value.aggregation,
    claimId: value.claimId,
    ...(validPrecision(value.precision) ? { precision: value.precision } : {}),
  };
}

function normalizeTracePoint(value: unknown): TracePoint | undefined {
  if (!isRecord(value) || !finite(value.x) || !finite(value.y)
    || typeof value.series !== "string") return undefined;
  const series = boundedText(value.series, maximumLabelCodePoints, true);
  return series === undefined ? undefined : { x: value.x, y: value.y, series };
}

function normalizeProvenance(
  value: Record<string, unknown>,
): TrialSnapshotV2["provenance"] | undefined {
  if (!provenanceSource(value.source) || typeof value.method !== "string") return undefined;
  const method = boundedText(value.method, maximumLongValueCodePoints, true);
  if (method === undefined) return undefined;
  return {
    source: value.source,
    calibration: "uncalibrated",
    method,
    ...optionalFiniteNumber("sampleRateHz", value.sampleRateHz),
    ...optionalFiniteNumber("frameSize", value.frameSize),
    ...optionalFiniteNumber("hopSize", value.hopSize),
    ...optionalFiniteNumber("droppedFrames", value.droppedFrames),
  };
}

function validatesNormalizedPortfolio(
  portfolio: LearningPortfolioV2,
  curriculum: CurriculumLessonReader,
): boolean {
  if (!isKnownLesson(portfolio.active.labId, portfolio.active.lessonId, curriculum)) return false;
  return Object.entries(portfolio.attempts).every(([key, attempt]) =>
    key === attemptKey(attempt.labId, attempt.lessonId)
      && hasStageContent(attempt)
      && attempt.trials.length <= maximumTrialsPerLesson
      && attempt.trials.every((trial) => trial.labId === attempt.labId
        && trial.lessonId === attempt.lessonId),
  );
}

function hasStageContent(attempt: LessonAttemptV2): boolean {
  const index = lessonStages.indexOf(attempt.stage);
  return (index < lessonStages.indexOf("experiment") || text(attempt.prediction))
    && (index < lessonStages.indexOf("compare") || attempt.trials.length >= 2)
    && (index < lessonStages.indexOf("perform") || text(attempt.explanation))
    && (index < lessonStages.indexOf("transfer") || text(attempt.performanceReflection))
    && (index < lessonStages.indexOf("debrief") || text(attempt.transferResponse));
}

function optionalResponse<Key extends string>(key: Key, value: unknown): Partial<Record<Key, string>> {
  return optionalBoundedText(key, value, maximumResponseCodePoints);
}

function optionalBoundedText<Key extends string>(
  key: Key,
  value: unknown,
  maximum: number,
): Partial<Record<Key, string>> {
  if (typeof value !== "string") return {};
  const normalized = boundedText(value, maximum);
  return normalized ? { [key]: normalized } as Record<Key, string> : {};
}

function optionalTrimmedCappedText<Key extends string>(
  key: Key,
  value: unknown,
): Partial<Record<Key, string>> {
  if (!text(value) || value !== value.trim()
    || codePointLength(value) > maximumExtensionFactorCodePoints) return {};
  return { [key]: value } as Record<Key, string>;
}

function optionalFiniteNumber<Key extends string>(
  key: Key,
  value: unknown,
): Partial<Record<Key, number>> {
  return finite(value) ? { [key]: value } as Record<Key, number> : {};
}

function boundedText(value: string, maximum: number, allowEmpty = false): string | undefined {
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) return undefined;
  return Array.from(trimmed).slice(0, maximum).join("");
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function validFactor(value: unknown, definition: FactorDefinition): value is FactorValue {
  if (definition.kind === "number") {
    return finite(value) && value >= definition.min && value <= definition.max;
  }
  if (definition.kind === "select") {
    return typeof value === "string" && definition.options.some((option) => option.value === value);
  }
  return typeof value === "boolean";
}

function observableValue(value: unknown): value is string | number {
  return typeof value === "string" || finite(value);
}

function validPrecision(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

function aggregation(value: unknown): value is ObservableRecord["aggregation"] {
  return value === "instantaneous" || value === "terminal-mean"
    || value === "range" || value === "distribution";
}

function provenanceSource(value: unknown): value is TrialSnapshotV2["provenance"]["source"] {
  return value === "model" || value === "synthetic" || value === "microphone" || value === "file";
}

function isKnownLesson(
  labId: unknown,
  lessonId: unknown,
  curriculum: CurriculumLessonReader,
): labId is CurriculumDomainId {
  return typeof labId === "string" && typeof lessonId === "string"
    && curriculum.lessonById(labId, lessonId) !== undefined;
}

function isFactorValue(value: unknown): value is FactorValue {
  return typeof value === "string" || typeof value === "boolean" || finite(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function iso(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function sameJson(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));
  } catch {
    return false;
  }
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
