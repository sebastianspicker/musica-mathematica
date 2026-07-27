import { defaultLabLesson, labLessonById } from "../../labs/catalog";
import type { LabId, TrialSnapshotV2 } from "../../labs/types";
import {
  lessonStages,
  type LessonResponseField,
  type LessonStage,
} from "../lessonAttempt";
import { attemptKey, maximumTrialsPerLesson } from "./constants";
import type { LearningPortfolioV2, LessonAttemptV2 } from "./types";
import {
  isLessonAttemptV2,
  isTrialSnapshotV2,
  sanitizePortfolio,
  sanitizeTrial,
} from "./validate";

export { attemptKey };

export function createPortfolio(): LearningPortfolioV2 {
  return {
    version: 2,
    active: { labId: defaultLabLesson.labId, lessonId: defaultLabLesson.id },
    attempts: {},
  };
}

export function createAttemptV2(
  labId: LabId,
  lessonId: string,
  now = new Date().toISOString(),
): LessonAttemptV2 {
  if (!labLessonById(labId, lessonId)) throw new RangeError("Attempt must reference a catalog lesson.");
  return { version: 2, labId, lessonId, stage: "orient", trials: [], updatedAt: now };
}

export function activeAttempt(portfolio: LearningPortfolioV2): LessonAttemptV2 {
  return portfolio.attempts[attemptKey(portfolio.active.labId, portfolio.active.lessonId)]
    ?? createAttemptV2(portfolio.active.labId, portfolio.active.lessonId);
}

export function selectLesson(
  portfolio: LearningPortfolioV2,
  labId: LabId,
  lessonId: string,
  now = new Date().toISOString(),
): LearningPortfolioV2 {
  if (!labLessonById(labId, lessonId)) return portfolio;
  const key = attemptKey(labId, lessonId);
  return sanitizePortfolio({
    ...portfolio,
    active: { labId, lessonId },
    attempts: {
      ...portfolio.attempts,
      [key]: portfolio.attempts[key] ?? createAttemptV2(labId, lessonId, now),
    },
  });
}

export function updateAttempt(
  portfolio: LearningPortfolioV2,
  attempt: LessonAttemptV2,
): LearningPortfolioV2 {
  if (!isLessonAttemptV2(attempt)) return portfolio;
  return sanitizePortfolio({
    ...portfolio,
    active: { labId: attempt.labId, lessonId: attempt.lessonId },
    attempts: { ...portfolio.attempts, [attemptKey(attempt.labId, attempt.lessonId)]: attempt },
  });
}

export function setAttemptPrediction(
  attempt: LessonAttemptV2,
  prediction: string,
  now = new Date().toISOString(),
): LessonAttemptV2 {
  const value = prediction.trim();
  if (!value || lessonStages.indexOf(attempt.stage) >= lessonStages.indexOf("experiment")) return attempt;
  return { ...attempt, prediction: value, stage: "predict", updatedAt: now };
}

export function advanceAttempt(
  attempt: LessonAttemptV2,
  stage: LessonStage,
  now = new Date().toISOString(),
): LessonAttemptV2 {
  const currentIndex = lessonStages.indexOf(attempt.stage);
  if (lessonStages[currentIndex + 1] !== stage) return attempt;
  if (stage === "experiment" && !attempt.prediction) return attempt;
  if ((stage === "compare" || stage === "explain") && attempt.trials.length < 2) return attempt;
  if (stage === "perform" && !attempt.explanation) return attempt;
  if (stage === "transfer" && !attempt.performanceReflection) return attempt;
  if (stage === "debrief" && !attempt.transferResponse) return attempt;
  return { ...attempt, stage, updatedAt: now };
}

export function setAttemptResponse(
  attempt: LessonAttemptV2,
  field: LessonResponseField,
  response: string,
  now = new Date().toISOString(),
): LessonAttemptV2 {
  const value = response.trim();
  const requiredStage: Record<LessonResponseField, LessonStage> = {
    explanation: "explain",
    performanceReflection: "perform",
    transferResponse: "transfer",
  };
  if (!value || attempt.stage !== requiredStage[field]) return attempt;
  return { ...attempt, [field]: value, updatedAt: now };
}

export function recordTrial(
  attempt: LessonAttemptV2,
  trial: TrialSnapshotV2,
  now = new Date().toISOString(),
): LessonAttemptV2 {
  if (attempt.stage !== "experiment" || !attempt.prediction) return attempt;
  const normalizedTrial = sanitizeTrial(trial);
  if (
    normalizedTrial.labId !== attempt.labId ||
    normalizedTrial.lessonId !== attempt.lessonId ||
    !isTrialSnapshotV2(normalizedTrial)
  ) return attempt;
  return {
    ...attempt,
    trials: [...attempt.trials, normalizedTrial].slice(-maximumTrialsPerLesson),
    updatedAt: now,
  };
}
