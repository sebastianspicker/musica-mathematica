import { describe, expect, it } from "vitest";
import { curriculumRegistry } from "../../curriculum/catalog";
import { createPortfolio } from "../../learning/portfolio/aggregate";
import { autosaveOutcome, clearOutcome } from "./usePortfolio";

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
