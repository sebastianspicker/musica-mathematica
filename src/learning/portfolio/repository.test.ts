import { describe, expect, it } from "vitest";
import type { LessonAttemptV1 } from "./legacy/schema";
import { createAttemptV2, createPortfolio, updateAttempt } from "./aggregate";
import {
  legacyPortfolioStorageKey,
  maximumRawPortfolioJsonBytes,
  maximumResponseCodePoints,
  portfolioStorageKey,
} from "./schema";
import {
  clearPortfolio,
  exportPortfolioJson,
  loadPortfolio,
  loadPortfolioDetailed,
  savePortfolio,
  savePortfolioDetailed,
} from "./repository";
import { testCurriculum } from "./curriculumFixture.test-helper";

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
  setCalls = 0;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.setCalls += 1;
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

  it("exports sanitized compact JSON and clears both schema keys", () => {
    const storage = new MemoryStorage();
    const portfolio = createPortfolio(testCurriculum);
    storage.setItem(portfolioStorageKey, "v2");
    storage.setItem(legacyPortfolioStorageKey, "v1");
    expect(exportPortfolioJson(portfolio, testCurriculum)).toBe(JSON.stringify(portfolio));
    expect(clearPortfolio(storage)).toBe(true);
    expect(storage.getItem(portfolioStorageKey)).toBeNull();
    expect(storage.getItem(legacyPortfolioStorageKey)).toBeNull();
  });

  it("keeps the established storage keys stable", () => {
    expect(portfolioStorageKey).toBe("musicaMathematica.learning.v2");
    expect(legacyPortfolioStorageKey).toBe("ensembleCouplingLab.learning.v1");
  });

  it("leaves oversized v2 storage untouched and disables automatic persistence", () => {
    const storage = new MemoryStorage();
    const oversized = "x".repeat(maximumRawPortfolioJsonBytes + 1);
    storage.values.set(portfolioStorageKey, oversized);
    storage.values.set(legacyPortfolioStorageKey, JSON.stringify(legacyLatencyAttempt));

    const loaded = loadPortfolioDetailed(storage, testCurriculum);

    expect(loaded.normalizationStatus).toBe("blocked");
    expect(loaded.persistenceStatus).toBe("disabled");
    expect(loaded.automaticPersistenceEnabled).toBe(false);
    expect(storage.values.get(portfolioStorageKey)).toBe(oversized);
    expect(storage.setCalls).toBe(0);
  });

  it("does not parse or rewrite an oversized legacy record", () => {
    const storage = new MemoryStorage();
    const oversized = "x".repeat(maximumRawPortfolioJsonBytes + 1);
    storage.values.set(legacyPortfolioStorageKey, oversized);

    const loaded = loadPortfolioDetailed(storage, testCurriculum);

    expect(loaded.persistenceStatus).toBe("disabled");
    expect(loaded.automaticPersistenceEnabled).toBe(false);
    expect(storage.values.has(portfolioStorageKey)).toBe(false);
    expect(storage.values.get(legacyPortfolioStorageKey)).toBe(oversized);
    expect(storage.setCalls).toBe(0);
  });

  it("returns the normalized saved portfolio and reports storage failures", () => {
    const storage = new MemoryStorage();
    const attempt = {
      ...createAttemptV2(
        testCurriculum,
        "phase-proportion",
        "from-bpm-to-period",
        "2026-08-28T10:00:00.000Z",
      ),
      stage: "experiment" as const,
      prediction: "🎼".repeat(maximumResponseCodePoints + 1),
    };
    const portfolio = {
      ...createPortfolio(testCurriculum),
      attempts: { "phase-proportion:from-bpm-to-period": attempt },
    };

    const saved = savePortfolioDetailed(portfolio, storage, testCurriculum);
    expect(saved.normalizationStatus).toBe("normalized");
    expect(saved.persistenceStatus).toBe("saved");
    expect(Array.from(saved.portfolio?.attempts["phase-proportion:from-bpm-to-period"]
      ?.prediction ?? "")).toHaveLength(maximumResponseCodePoints);

    const failed = savePortfolioDetailed(portfolio, {
      getItem: () => null,
      setItem: () => { throw new Error("quota"); },
      removeItem: () => undefined,
    }, testCurriculum);
    expect(failed.persistenceStatus).toBe("failed");
    expect(failed.notice).toContain("unavailable");
  });
});
