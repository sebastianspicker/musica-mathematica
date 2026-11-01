import { describe, expect, it } from "vitest";
import { curriculumRegistry } from "../../curriculum/catalog";
import { activeAttempt, createPortfolio, selectLesson, setAttemptPrediction, updateAttempt } from "../../learning/portfolio/aggregate";
import { savePortfolioDetailed } from "../../learning/portfolio/repository";
import { attemptKey, type LearningPortfolioV2 } from "../../learning/portfolio/schema";
import { autosaveOutcome, clearOutcome, isPortfolioStorageKey, reloadPortfolio } from "./usePortfolio";

describe("autosaveOutcome", () => {
  const portfolio = createPortfolio(curriculumRegistry);

  it("reports a plain save without a message or replacement", () => {
    expect(autosaveOutcome({ portfolio, normalizationStatus: "unchanged", persistenceStatus: "saved" })).toEqual({
      persistenceStatus: "saved",
      disableAutomaticPersistence: false,
      message: undefined,
      replacement: undefined,
    });
  });

  it.each(["normalized", "compacted"] as const)("replaces the portfolio when it was %s", (normalizationStatus) => {
    const outcome = autosaveOutcome({ portfolio, normalizationStatus, persistenceStatus: "saved", notice: "Trimmed." });
    expect(outcome.replacement).toBe(portfolio);
    expect(outcome.message).toBe("Trimmed.");
  });

  it("does not replace the portfolio when normalization produced none", () => {
    expect(autosaveOutcome({ normalizationStatus: "normalized", persistenceStatus: "saved" }).replacement).toBeUndefined();
  });

  it("turns automatic persistence off when saving is disabled", () => {
    const outcome = autosaveOutcome({ normalizationStatus: "blocked", persistenceStatus: "disabled", notice: "Recovery." });
    expect(outcome).toMatchObject({ persistenceStatus: "disabled", disableAutomaticPersistence: true, message: "Recovery." });
    expect(outcome.replacement).toBeUndefined();
  });
});

describe("clearOutcome", () => {
  it.each([
    [true, false, "All local learning records were cleared."],
    [true, true, "Demo data was reset."],
  ])("re-enables saving after a successful clear (cleared=%s demo=%s)", (cleared, demoMode, message) => {
    expect(clearOutcome(cleared, demoMode)).toEqual({ persistenceStatus: "not-needed", enableAutomaticPersistence: true, message });
  });

  it("reports a failed clear without re-enabling saving", () => {
    expect(clearOutcome(false, false)).toEqual({
      persistenceStatus: "failed",
      enableAutomaticPersistence: false,
      message: "Storage could not be cleared; use the browser's site-data controls.",
    });
  });
});

describe("reloadPortfolio", () => {
  const curriculum = curriculumRegistry;
  const [lessonX, lessonY] = curriculum.catalog.flatMap((domain) => domain.lessons);
  const withPrediction = (portfolio: LearningPortfolioV2, text: string): LearningPortfolioV2 =>
    updateAttempt(curriculum, portfolio, setAttemptPrediction(activeAttempt(curriculum, portfolio), text));

  it("lets a second tab pick up the first tab's save so both lessons survive", () => {
    const { storage, values, setCalls } = countingStorage();
    const tabA = withPrediction(selectLesson(curriculum, createPortfolio(curriculum), lessonX.domainId, lessonX.id), "Tab A");
    savePortfolioDetailed(tabA, storage, curriculum);
    const callsBeforeReload = setCalls();

    const tabB = reloadPortfolio(storage, curriculum, lessonY);
    expect(setCalls()).toBe(callsBeforeReload);
    expect(tabB.persistenceStatus).toBe("saved");
    expect(tabB.portfolio?.active).toEqual({ labId: lessonY.domainId, lessonId: lessonY.id });
    savePortfolioDetailed(withPrediction(tabB.portfolio!, "Tab B"), storage, curriculum);

    const reopened = reloadPortfolio(storage, curriculum, lessonX).portfolio!;
    expect(values.size).toBe(1);
    expect(reopened.attempts[attemptKey(lessonX.domainId, lessonX.id)]?.prediction).toBe("Tab A");
    expect(reopened.attempts[attemptKey(lessonY.domainId, lessonY.id)]?.prediction).toBe("Tab B");
  });

  it("never rewrites the record while reloading, even when another build stored a different normalized copy", () => {
    const { storage, values, writtenKeys } = countingStorage();
    // Pretty-printed JSON is valid but not this build's canonical form, so a writing load would rewrite it.
    const raw = JSON.stringify(withPrediction(createPortfolio(curriculum), "Stored elsewhere"), null, 2);
    values.set("musicaMathematica.learning.v2", raw);

    expect(reloadPortfolio(storage, curriculum, lessonX).portfolio).toBeDefined();
    expect(values.get("musicaMathematica.learning.v2")).toBe(raw);
    expect(writtenKeys).toEqual(["musicaMathematica.learning.v2.backup"]);
  });

  it("backs up a record from a newer build before this tab would trim it", () => {
    const { storage, values } = countingStorage();
    const portfolio = withPrediction(createPortfolio(curriculum), "Kept");
    const later = { ...activeAttempt(curriculum, portfolio), lessonId: "added-later" };
    const raw = JSON.stringify({ ...portfolio, attempts: { ...portfolio.attempts, [attemptKey(later.labId, "added-later")]: later } });
    values.set("musicaMathematica.learning.v2", raw);

    expect(reloadPortfolio(storage, curriculum, lessonX).portfolio?.attempts[attemptKey(later.labId, "added-later")]).toBeUndefined();
    expect(values.get("musicaMathematica.learning.v2")).toBe(raw);
    expect(values.get("musicaMathematica.learning.v2.backup")).toBe(raw);
  });

  it("keeps this tab's work and stops saving when another tab stored data it cannot read", () => {
    const { storage, values, writtenKeys } = countingStorage();
    values.set("musicaMathematica.learning.v2", "{");

    const reloaded = reloadPortfolio(storage, curriculum, lessonX);
    expect(reloaded.portfolio).toBeUndefined();
    expect(reloaded).toMatchObject({ automaticPersistenceEnabled: false, persistenceStatus: "disabled" });
    expect(writtenKeys).toEqual(["musicaMathematica.learning.v2.backup"]);
    expect(values.get("musicaMathematica.learning.v2")).toBe("{");
  });

  it("follows another tab's clear", () => {
    const { storage } = countingStorage();
    expect(reloadPortfolio(storage, curriculum, lessonY)).toMatchObject({
      portfolio: { active: { labId: lessonY.domainId, lessonId: lessonY.id } },
      automaticPersistenceEnabled: true,
    });
  });

  it("reacts only to keys this app writes", () => {
    expect([null, "musicaMathematica.learning.v2", "musicaMathematica.demo.learning.v2", "ensembleCouplingLab.learning.v1"].every(isPortfolioStorageKey)).toBe(true);
    expect(isPortfolioStorageKey("another-project.settings")).toBe(false);
    expect(isPortfolioStorageKey("musicaMathematica.learning.v2.backup")).toBe(false);
  });
});

function countingStorage() {
  const values = new Map<string, string>();
  const writtenKeys: string[] = [];
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { writtenKeys.push(key); values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  return { storage, values, writtenKeys, setCalls: () => writtenKeys.length };
}
