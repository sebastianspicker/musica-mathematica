import { describe, expect, it } from "vitest";
import {
  type EnsembleMetrics,
  modelLatencyBudgetSeconds,
  modelLatencyBudgetStatus,
} from "./ensemble";
import { defaultConfig } from "./presets";
import { rehearsalSuggestions } from "./suggestions";

function metricsWithBudget(modelLatencyBudgetSeconds: number): EnsembleMetrics {
  return {
    coherence: 0.9,
    phaseSpread: 0,
    phaseSpreadEquivalentMs: 0,
    leaderToFollowerPhaseLagMs: null,
    sectionCoherences: null,
    peerCouplingShare: 1,
    modelLatencyBudgetSeconds,
  };
}

describe("rehearsalSuggestions", () => {
  it("matches latency-budget status at threshold boundaries", () => {
    const budget = modelLatencyBudgetSeconds(defaultConfig);
    const cases = [
      {
        ratio: 0.549,
        status: "plausible",
        suggestion: "This configuration is within the model phase budget; real rehearsal fit still needs testing.",
      },
      {
        ratio: 0.55,
        status: "fragile",
        suggestion: "Model-based option: test sparser pulse material or anticipatory entries.",
      },
      {
        ratio: 0.849,
        status: "fragile",
        suggestion: "Model-based option: test sparser pulse material or anticipatory entries.",
      },
      {
        ratio: 0.85,
        status: "unstable",
        suggestion: "Model-based option: test a slower tempo, simpler density, or delayed response.",
      },
    ] as const;

    for (const testCase of cases) {
      const config = {
        ...defaultConfig,
        latencySeconds: budget * testCase.ratio,
      };
      const metrics = metricsWithBudget(budget);

      expect(modelLatencyBudgetStatus(config, metrics)).toBe(testCase.status);
      expect(rehearsalSuggestions(config, metrics)[0]).toBe(testCase.suggestion);
    }
  });
});
