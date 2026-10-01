import { describe, expect, it } from "vitest";
import { curriculumRegistry } from "../../curriculum/catalog";
import { defaultFactorsFor, type FactorDefinition, type FactorValue, type LessonDefinition } from "../../curriculum/contracts";
import {
  advanceAttempt,
  createAttemptV2,
  createPortfolio,
  createTrialSnapshot,
  recordTrial,
  setAttemptPrediction,
  updateAttempt,
} from "../../learning/portfolio/aggregate";
import { loadPortfolioDetailed, savePortfolioDetailed } from "../../learning/portfolio/repository";
import type { StoragePort } from "../../learning/portfolio/schema";

class MemoryStorage implements StoragePort {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function changedValue(factor: FactorDefinition): FactorValue {
  switch (factor.kind) {
    case "number": {
      const up = factor.defaultValue + factor.step;
      return up <= factor.max ? up : Math.max(factor.min, factor.defaultValue - factor.step);
    }
    case "select": return factor.options.find((option) => option.value !== factor.defaultValue)?.value ?? factor.defaultValue;
    case "toggle": return !factor.defaultValue;
  }
}

function comparedAttempt(lesson: LessonDefinition) {
  const defaults = defaultFactorsFor(lesson);
  const factor = lesson.factors.find((candidate) => changedValue(candidate) !== candidate.defaultValue);
  if (!factor) throw new RangeError(`Lesson ${lesson.id} has no factor that can change within bounds.`);
  const evaluate = curriculumRegistry.evaluatorFor(lesson.domainId, lesson.id);
  const trialFactors = [defaults, { ...defaults, [factor.id]: changedValue(factor) }];

  let attempt = createAttemptV2(curriculumRegistry, lesson.domainId, lesson.id, "2026-09-01T12:00:00.000Z");
  attempt = advanceAttempt(setAttemptPrediction(attempt, "Changing one factor changes the result.", "2026-09-01T12:00:10.000Z"), "experiment", "2026-09-01T12:00:20.000Z");
  trialFactors.forEach((factors, runIndex) => {
    const trial = createTrialSnapshot({
      lesson,
      runIndex,
      factors,
      evaluation: evaluate(factors),
      note: "Recorded by the round-trip test.",
      recordedAt: `2026-09-01T12:01:0${runIndex}.000Z`,
    });
    attempt = recordTrial(curriculumRegistry, attempt, trial, `2026-09-01T12:01:0${runIndex}.000Z`);
  });
  return advanceAttempt(attempt, "compare", "2026-09-01T12:02:00.000Z");
}

describe("portfolio persistence round trip", () => {
  const lessons = curriculumRegistry.catalog.flatMap((domain) => domain.lessons);

  it.each(lessons.map((lesson) => [`${lesson.domainId}:${lesson.id}`, lesson] as const))(
    "saves and reloads a two-run comparison for %s unchanged",
    (_key, lesson) => {
      const attempt = comparedAttempt(lesson);
      expect(attempt.stage).toBe("compare");
      expect(attempt.trials).toHaveLength(2);

      const portfolio = updateAttempt(curriculumRegistry, createPortfolio(curriculumRegistry), attempt);
      const storage = new MemoryStorage();
      const saved = savePortfolioDetailed(portfolio, storage, curriculumRegistry);
      expect(saved.persistenceStatus).toBe("saved");
      expect(saved.normalizationStatus).toBe("unchanged");

      const loaded = loadPortfolioDetailed(storage, curriculumRegistry);
      expect(loaded.source).toBe("v2");
      expect(loaded.normalizationStatus).toBe("unchanged");
      expect(loaded.portfolio).toEqual(portfolio);
    },
  );
});
