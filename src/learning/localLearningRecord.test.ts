import { describe, expect, it } from "vitest";
import { createLessonAttempt } from "./lessonAttempt";
import {
  clearLearningRecord,
  exportLearningRecordJson,
  learningRecordStorageKey,
  loadLearningRecord,
  saveLearningRecord,
  type LearningRecordStorage,
} from "./localLearningRecord";

function memoryStorage(): LearningRecordStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("local learning records", () => {
  it("round-trips only valid versioned attempts under the dedicated key", () => {
    const storage = memoryStorage();
    const attempt = createLessonAttempt("lock-in");

    expect(saveLearningRecord(attempt, storage)).toBe(true);
    expect(storage.values.has(learningRecordStorageKey)).toBe(true);
    expect(loadLearningRecord(storage)).toEqual(attempt);
    expect(exportLearningRecordJson(attempt)).toContain('"version": 1');
    expect(clearLearningRecord(storage)).toBe(true);
    expect(loadLearningRecord(storage)).toBeUndefined();
  });

  it("fails closed for corrupt JSON and malformed records", () => {
    const storage = memoryStorage();
    storage.setItem(learningRecordStorageKey, "not json");
    expect(loadLearningRecord(storage)).toBeUndefined();
    storage.setItem(learningRecordStorageKey, JSON.stringify({ version: 2 }));
    expect(loadLearningRecord(storage)).toBeUndefined();
    storage.setItem(
      learningRecordStorageKey,
      JSON.stringify({ ...createLessonAttempt("lock-in"), runs: [{ id: "run", durationSeconds: -1 }] }),
    );
    expect(loadLearningRecord(storage)).toBeUndefined();
  });
});
