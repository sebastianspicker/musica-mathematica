import { describe, expect, it } from "vitest";
import type { LessonAttemptV1 } from "../legacy-v1/schema";
import { createAttemptV2, createPortfolio, updateAttempt } from "./aggregate";
import { legacyPortfolioStorageKey, portfolioStorageKey } from "./constants";
import { clearPortfolio, exportPortfolioJson, loadPortfolio, savePortfolio } from "./repository";
import { testCurriculum } from "./testReader";

const legacyLatencyAttempt: LessonAttemptV1 = {
  version: 1,
  lessonId: "latency",
  stage: "experiment",
  prediction: "A historical prediction.",
  runs: [{
    id: "Legacy run",
    durationSeconds: 1,
    config: {
      musicianCount: 4,
      tempoBpm: 120,
      tempoSpreadBpm: 5,
      couplingStrength: 1,
      latencySeconds: 0.075,
      jitterSeconds: 0.01,
      topology: "leader-follower",
      repertoireTexture: "pulse",
      clickTrackStrength: 0,
    },
    metrics: {
      coherence: 0.8,
      phaseSpread: 0.2,
      phaseSpreadEquivalentMs: 10,
      peerCouplingShare: 0.5,
      modelLatencyBudgetSeconds: 0.1,
      leaderToFollowerPhaseLagMs: 4,
      sectionCoherences: null,
    },
  }],
};

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("portfolio repository", () => {
  it("prefers a valid v2 portfolio over a retained v1 record", () => {
    const storage = new MemoryStorage();
    const attempt = createAttemptV2(
      testCurriculum,
      "rhythm-meter",
      "cycles-and-euclidean-rhythm",
      "2026-08-28T10:00:00.000Z",
    );
    const expected = updateAttempt(testCurriculum, createPortfolio(testCurriculum), attempt);
    expect(savePortfolio(expected, storage, testCurriculum)).toBe(true);
    storage.setItem(legacyPortfolioStorageKey, JSON.stringify(legacyLatencyAttempt));
    expect(loadPortfolio(storage, testCurriculum, "2026-08-28T10:01:00.000Z")).toEqual(expected);
  });

  it("falls back from corrupt v2 to v1 and writes the migrated v2 record", () => {
    const storage = new MemoryStorage();
    storage.setItem(portfolioStorageKey, "{");
    storage.setItem(legacyPortfolioStorageKey, JSON.stringify(legacyLatencyAttempt));
    const loaded = loadPortfolio(storage, testCurriculum, "2026-08-28T10:00:00.000Z");
    expect(loaded.active).toEqual({ labId: "ensemble-dynamics", lessonId: "delay-jitter-topology" });
    expect(storage.getItem(portfolioStorageKey)).not.toBeNull();
    expect(storage.getItem(legacyPortfolioStorageKey)).not.toBeNull();
  });

  it("exports sanitized pretty JSON and clears both schema keys", () => {
    const storage = new MemoryStorage();
    const portfolio = createPortfolio(testCurriculum);
    storage.setItem(portfolioStorageKey, "v2");
    storage.setItem(legacyPortfolioStorageKey, "v1");
    expect(exportPortfolioJson(portfolio, testCurriculum)).toContain('\n  "version": 2');
    expect(clearPortfolio(storage)).toBe(true);
    expect(storage.getItem(portfolioStorageKey)).toBeNull();
    expect(storage.getItem(legacyPortfolioStorageKey)).toBeNull();
  });

  it("keeps the established storage keys stable", () => {
    expect(portfolioStorageKey).toBe("musicaMathematica.learning.v2");
    expect(legacyPortfolioStorageKey).toBe("ensembleCouplingLab.learning.v1");
  });
});
