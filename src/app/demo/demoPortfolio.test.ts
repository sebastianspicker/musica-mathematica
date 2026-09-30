import { describe, expect, it } from "vitest";
import { curriculumRegistry } from "../../curriculum/catalog";
import { assessTrialComparison } from "../../learning/inquiry/comparison";
import { attemptKey } from "../../learning/portfolio/schema";
import { isLearningPortfolioV2 } from "../../learning/portfolio/validate";
import { createDemoPortfolio } from "./demoPortfolio";

describe("createDemoPortfolio", () => {
  it("creates the mockup's controlled 90 to 120 BPM comparison", () => {
    const portfolio = createDemoPortfolio(curriculumRegistry);
    const lesson = curriculumRegistry.lessonById("phase-proportion", "from-bpm-to-period");
    const attempt = portfolio.attempts[attemptKey("phase-proportion", "from-bpm-to-period")];

    expect(lesson).toBeDefined();
    expect(isLearningPortfolioV2(portfolio, curriculumRegistry)).toBe(true);
    expect(portfolio.active).toEqual({ labId: "phase-proportion", lessonId: "from-bpm-to-period" });
    expect(attempt?.stage).toBe("compare");
    expect(attempt?.trials.map((trial) => trial.factors.bpm)).toEqual([90, 120]);
    expect(attempt?.trials.map((trial) => trial.observables[0]?.value)).toEqual([60 / 90, 0.5]);
    expect(attempt?.trials.every((trial) => trial.provenance.source === "model")).toBe(true);
    expect(lesson && attempt ? assessTrialComparison(lesson, attempt.trials) : undefined).toMatchObject({
      valid: true,
      changedFactorIds: ["bpm"],
    });
  });

  it("is byte-for-byte deterministic", () => {
    expect(JSON.stringify(createDemoPortfolio(curriculumRegistry)))
      .toBe(JSON.stringify(createDemoPortfolio(curriculumRegistry)));
  });
});
