import {
  seedForTrial,
  type CurriculumDomainId,
  type CurriculumLessonReader,
  type EvaluationOutput,
  type FactorValue,
  type LessonDefinition,
} from "../../curriculum/contracts";
import { lessonStages, type LessonResponseField, type LessonStage } from "../stages";
import {
  attemptKey,
  maximumTrialsPerLesson,
  type LearningPortfolioV2,
  type LessonAttemptV2,
  type TrialSnapshotV2,
} from "./schema";
import {
  isTrialSnapshotV2,
  normalizeLessonAttempt,
  sanitizePortfolio,
  sanitizeTrial,
} from "./validate";

export { attemptKey };

export function createPortfolio(curriculum: CurriculumLessonReader): LearningPortfolioV2 {
  return {
    version: 2,
    active: {
      labId: curriculum.defaultLesson.domainId,
      lessonId: curriculum.defaultLesson.id,
    },
    attempts: {},
  };
}

export function createAttemptV2(
  curriculum: CurriculumLessonReader,
  labId: CurriculumDomainId,
  lessonId: string,
  now = new Date().toISOString(),
): LessonAttemptV2 {
  if (!curriculum.lessonById(labId, lessonId)) {
    throw new RangeError("Attempt must reference a catalog lesson.");
  }
  return { version: 2, labId, lessonId, stage: "orient", trials: [], updatedAt: now };
}

export function activeAttempt(curriculum: CurriculumLessonReader, portfolio: LearningPortfolioV2): LessonAttemptV2 {
  const key = attemptKey(portfolio.active.labId, portfolio.active.lessonId);
  return portfolio.attempts[key]
    ?? createAttemptV2(curriculum, portfolio.active.labId, portfolio.active.lessonId);
}

export function selectLesson(
  curriculum: CurriculumLessonReader,
  portfolio: LearningPortfolioV2,
  labId: CurriculumDomainId,
  lessonId: string,
  now = new Date().toISOString(),
): LearningPortfolioV2 {
  if (!curriculum.lessonById(labId, lessonId)) return portfolio;

  const key = attemptKey(labId, lessonId);
  const attempt = portfolio.attempts[key] ?? createAttemptV2(curriculum, labId, lessonId, now);
  return sanitizePortfolio({
    ...portfolio,
    active: { labId, lessonId },
    attempts: { ...portfolio.attempts, [key]: attempt },
  }, curriculum);
}

export function updateAttempt(
  curriculum: CurriculumLessonReader,
  portfolio: LearningPortfolioV2,
  attempt: LessonAttemptV2,
): LearningPortfolioV2 {
  const normalizedAttempt = normalizeLessonAttempt(attempt, curriculum);
  if (!normalizedAttempt) return portfolio;
  return sanitizePortfolio({
    ...portfolio,
    active: { labId: normalizedAttempt.labId, lessonId: normalizedAttempt.lessonId },
    attempts: {
      ...portfolio.attempts,
      [attemptKey(normalizedAttempt.labId, normalizedAttempt.lessonId)]: normalizedAttempt,
    },
  }, curriculum);
}

export function setAttemptPrediction(
  attempt: LessonAttemptV2,
  prediction: string,
  now = new Date().toISOString(),
): LessonAttemptV2 {
  const value = prediction.trim();
  if (!value || stageIndex(attempt.stage) >= stageIndex("experiment")) return attempt;
  return { ...attempt, prediction: value, stage: "predict", updatedAt: now };
}

export function advanceAttempt(
  attempt: LessonAttemptV2,
  stage: LessonStage,
  now = new Date().toISOString(),
): LessonAttemptV2 {
  if (!isNextStage(attempt.stage, stage) || !meetsStageRequirement(attempt, stage)) {
    return attempt;
  }
  return { ...attempt, stage, updatedAt: now };
}

export function setAttemptResponse(
  attempt: LessonAttemptV2,
  field: LessonResponseField,
  response: string,
  now = new Date().toISOString(),
): LessonAttemptV2 {
  const value = response.trim();
  if (!value || attempt.stage !== responseStage(field)) return attempt;
  return { ...attempt, [field]: value, updatedAt: now };
}

export function recordTrial(
  curriculum: CurriculumLessonReader,
  attempt: LessonAttemptV2,
  trial: TrialSnapshotV2,
  now = new Date().toISOString(),
): LessonAttemptV2 {
  if (attempt.stage !== "experiment" || !attempt.prediction) return attempt;

  const normalizedTrial = sanitizeTrial(trial, curriculum);
  if (!isTrialForAttempt(normalizedTrial, attempt, curriculum)) return attempt;
  return {
    ...attempt,
    trials: [...attempt.trials, normalizedTrial].slice(-maximumTrialsPerLesson),
    updatedAt: now,
  };
}

/** Detect reductions made when accepting a run, before persistence sees it. */
export function recordedRunWasTrimmed(previous: LessonAttemptV2, submitted: TrialSnapshotV2, next: LessonAttemptV2): boolean {
  const saved = next.trials.at(-1);
  return saved !== undefined && (
    next.trials.length < previous.trials.length + 1
    || (saved.note?.length ?? 0) < (submitted.note?.length ?? 0)
    || saved.trace.length < submitted.trace.length
    || saved.observables.length < submitted.observables.length
  );
}

export function runLabel(runCount: number): string {
  if (runCount === 0) return "Run A";
  if (runCount === 1) return "Run B";
  return `Run ${runCount + 1}`;
}

export type TrialSnapshotInput = Readonly<{
  lesson: LessonDefinition;
  runIndex: number;
  factors: Readonly<Record<string, FactorValue>>;
  evaluation: EvaluationOutput;
  note: string;
  recordedAt: string;
}>;

/** Build the persisted snapshot of one evaluated run; `runIndex` is the count of earlier trials. */
export function createTrialSnapshot({ lesson, runIndex, factors, evaluation, note, recordedAt }: TrialSnapshotInput): TrialSnapshotV2 {
  const deterministic = (evaluation.provenance.source === "model" || evaluation.provenance.source === "synthetic") && lesson.protocol.deterministic;
  return { id: runLabel(runIndex), labId: lesson.domainId, lessonId: lesson.id, protocolId: lesson.protocol.id, deterministic, ...(deterministic && lesson.protocol.seed ? { seed: seedForTrial(lesson, factors) } : {}), recordedAt, factors: { ...factors }, observables: evaluation.observables.map((item) => ({ ...item })), trace: evaluation.trace.map((point) => ({ ...point })), provenance: { ...evaluation.provenance }, ...(note.trim() ? { note: note.trim() } : {}) };
}

function isTrialForAttempt(trial: TrialSnapshotV2, attempt: LessonAttemptV2, curriculum: CurriculumLessonReader): boolean {
  return trial.labId === attempt.labId
    && trial.lessonId === attempt.lessonId
    && isTrialSnapshotV2(trial, curriculum);
}

function isNextStage(currentStage: LessonStage, nextStage: LessonStage): boolean {
  return lessonStages[stageIndex(currentStage) + 1] === nextStage;
}

function meetsStageRequirement(attempt: LessonAttemptV2, stage: LessonStage): boolean {
  switch (stage) {
    case "experiment": return Boolean(attempt.prediction);
    case "compare":
    case "explain": return attempt.trials.length >= 2;
    case "perform": return Boolean(attempt.explanation);
    case "transfer": return Boolean(attempt.performanceReflection);
    case "debrief": return Boolean(attempt.transferResponse);
    default: return true;
  }
}

function responseStage(field: LessonResponseField): LessonStage {
  switch (field) {
    case "explanation": return "explain";
    case "performanceReflection": return "perform";
    case "transferResponse": return "transfer";
  }
}

function stageIndex(stage: LessonStage): number {
  return lessonStages.indexOf(stage);
}
