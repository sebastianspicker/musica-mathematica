import { isLessonAttemptV1, type LessonAttemptV1 } from "./lessonAttempt";

export const learningRecordStorageKey = "ensembleCouplingLab.learning.v1";

export type LearningRecordStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadLearningRecord(storage: LearningRecordStorage | undefined = browserStorage()): LessonAttemptV1 | undefined {
  if (storage === undefined) return undefined;
  try {
    const raw = storage.getItem(learningRecordStorageKey);
    if (raw === null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return isLessonAttemptV1(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function saveLearningRecord(
  attempt: LessonAttemptV1,
  storage: LearningRecordStorage | undefined = browserStorage(),
): boolean {
  if (storage === undefined || !isLessonAttemptV1(attempt)) return false;
  try {
    storage.setItem(learningRecordStorageKey, JSON.stringify(attempt));
    return true;
  } catch {
    return false;
  }
}

export function clearLearningRecord(storage: LearningRecordStorage | undefined = browserStorage()): boolean {
  if (storage === undefined) return false;
  try {
    storage.removeItem(learningRecordStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function exportLearningRecordJson(attempt: LessonAttemptV1): string | undefined {
  return isLessonAttemptV1(attempt) ? JSON.stringify(attempt, null, 2) : undefined;
}

function browserStorage(): LearningRecordStorage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
