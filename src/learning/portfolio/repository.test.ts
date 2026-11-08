import { describe, expect, it } from "vitest";
import type { LessonAttemptV1 } from "./legacy/schema";
import { createAttemptV2, createPortfolio, updateAttempt } from "./aggregate";
import {
  legacyPortfolioStorageKey,
  maximumRawPortfolioJsonBytes,
  maximumResponseCodePoints,
  portfolioStorageKey,
  portfolioBackupStorageKey,
} from "./schema";
import {
  clearPortfolio,
  exportPortfolioJson,
  loadPortfolioDetailed,
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
    expect(savePortfolioDetailed(expected, storage, testCurriculum).persistenceStatus).toBe("saved");
    storage.setItem(legacyPortfolioStorageKey, JSON.stringify(legacyLatencyAttempt));
    expect(loadPortfolioDetailed(storage, testCurriculum, "2026-08-28T10:01:00.000Z").portfolio).toEqual(expected);
  });

  it("falls back from corrupt v2 to v1 and writes the migrated v2 record", () => {
    const storage = new MemoryStorage();
    storage.setItem(portfolioStorageKey, "{");
    storage.setItem(legacyPortfolioStorageKey, JSON.stringify(legacyLatencyAttempt));
    const loaded = loadPortfolioDetailed(storage, testCurriculum, "2026-08-28T10:00:00.000Z").portfolio;
    expect(loaded.active).toEqual({ labId: "ensemble-dynamics", lessonId: "delay-jitter-topology" });
    expect(storage.getItem(portfolioStorageKey)).not.toBeNull();
    expect(storage.getItem(legacyPortfolioStorageKey)).not.toBeNull();
  });

  it("says so when an older saved record cannot be converted, and leaves it in place", () => {
    const storage = new MemoryStorage();
    storage.setItem(legacyPortfolioStorageKey, "{");

    const loaded = loadPortfolioDetailed(storage, testCurriculum);

    expect(loaded.source).toBe("empty");
    expect(loaded.notice).toContain("could not be converted");
    expect(storage.getItem(legacyPortfolioStorageKey)).toBe("{");
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
    expect(portfolioBackupStorageKey).toBe("musicaMathematica.learning.v2.backup");
  });

  it("keeps a copy of unreadable v2 data and says so before the first save replaces it", () => {
    const storage = new MemoryStorage();
    const unreadable = JSON.stringify({ version: 2, active: {}, attempts: [] });
    storage.values.set(portfolioStorageKey, unreadable);

    const loaded = loadPortfolioDetailed(storage, testCurriculum);
    expect(loaded).toMatchObject({ source: "empty", normalizationStatus: "invalid", automaticPersistenceEnabled: true });
    expect(loaded.notice).toContain("could not be read");
    savePortfolioDetailed(loaded.portfolio, storage, testCurriculum);

    expect(storage.values.get(portfolioBackupStorageKey)).toBe(unreadable);
    expect(storage.values.get(portfolioStorageKey)).not.toBe(unreadable);
    expect(clearPortfolio(storage)).toBe(true);
    expect(storage.values.has(portfolioBackupStorageKey)).toBe(false);
  });

  it("keeps every valid attempt when the stored active lesson is unknown", () => {
    const storage = new MemoryStorage();
    const portfolio = updateAttempt(testCurriculum, createPortfolio(testCurriculum), {
      ...createAttemptV2(testCurriculum, "ensemble-dynamics", "lock-in-and-order", "2026-08-28T10:00:00.000Z"),
      stage: "predict",
      prediction: "Stronger coupling raises coherence.",
    });
    storage.values.set(portfolioStorageKey, JSON.stringify({ ...portfolio, active: { labId: "ensemble-dynamics", lessonId: "added-later" } }));

    const loaded = loadPortfolioDetailed(storage, testCurriculum);

    expect(loaded.source).toBe("v2");
    expect(loaded.portfolio.active).toEqual({ labId: "phase-proportion", lessonId: "from-bpm-to-period" });
    expect(loaded.portfolio.attempts["ensemble-dynamics:lock-in-and-order"]?.prediction).toBe("Stronger coupling raises coherence.");
  });

  it("does not trust a storage adapter that silently ignores the backup key", () => {
    const values = new Map([[portfolioStorageKey, "{"]]);
    const loaded = loadPortfolioDetailed({
      getItem: (key) => key === portfolioStorageKey ? values.get(key) ?? null : null,
      setItem: (key, value) => { if (key === portfolioStorageKey) values.set(key, value); },
      removeItem: () => undefined,
    }, testCurriculum);

    expect(loaded).toMatchObject({ normalizationStatus: "blocked", automaticPersistenceEnabled: false });
    expect(loaded.notice).toContain("no copy of it could be kept");
  });

  it("keeps the other lessons when the active attempt cannot be read, with a copy of the original", () => {
    const storage = new MemoryStorage();
    const portfolio = updateAttempt(testCurriculum, createPortfolio(testCurriculum), {
      ...createAttemptV2(testCurriculum, "ensemble-dynamics", "lock-in-and-order", "2026-08-28T10:00:00.000Z"),
      stage: "predict",
      prediction: "Stronger coupling raises coherence.",
    });
    const broken = { ...createAttemptV2(testCurriculum, "phase-proportion", "from-bpm-to-period", "2026-08-28T10:00:00.000Z"), stage: "compare" };
    const raw = JSON.stringify({
      ...portfolio,
      active: { labId: "phase-proportion", lessonId: "from-bpm-to-period" },
      attempts: { ...portfolio.attempts, "phase-proportion:from-bpm-to-period": broken },
    });
    storage.values.set(portfolioStorageKey, raw);

    const loaded = loadPortfolioDetailed(storage, testCurriculum);

    expect(loaded.source).toBe("v2");
    expect(loaded.portfolio.attempts["ensemble-dynamics:lock-in-and-order"]?.prediction).toBe("Stronger coupling raises coherence.");
    expect(loaded.portfolio.attempts["phase-proportion:from-bpm-to-period"]).toBeUndefined();
    expect(storage.values.get(portfolioBackupStorageKey)).toBe(raw);
    expect(loaded.notice).toContain("copy");
  });

  it("does not drop attempts on load when the backup slot already holds other data", () => {
    const storage = new MemoryStorage();
    const portfolio = createPortfolio(testCurriculum);
    const later = { ...createAttemptV2(testCurriculum, "phase-proportion", "from-bpm-to-period", "2026-08-28T10:00:00.000Z"), lessonId: "added-later" };
    const raw = JSON.stringify({ ...portfolio, attempts: { "phase-proportion:added-later": later } });
    storage.values.set(portfolioStorageKey, raw);
    storage.values.set(portfolioBackupStorageKey, "earlier unreadable data");

    const loaded = loadPortfolioDetailed(storage, testCurriculum);

    expect(loaded).toMatchObject({ persistenceStatus: "disabled", automaticPersistenceEnabled: false });
    expect(storage.values.get(portfolioStorageKey)).toBe(raw);
    expect(storage.values.get(portfolioBackupStorageKey)).toBe("earlier unreadable data");
  });

  it("keeps the original before a load rewrites it without attempts for lessons this build lacks", () => {
    const storage = new MemoryStorage();
    const portfolio = createPortfolio(testCurriculum);
    const later = { ...createAttemptV2(testCurriculum, "phase-proportion", "from-bpm-to-period", "2026-08-28T10:00:00.000Z"), lessonId: "added-later" };
    const raw = JSON.stringify({ ...portfolio, attempts: { "phase-proportion:added-later": later } });
    storage.values.set(portfolioStorageKey, raw);

    const loaded = loadPortfolioDetailed(storage, testCurriculum);

    expect(loaded.portfolio.attempts).toEqual({});
    expect(storage.values.get(portfolioStorageKey)).not.toBe(raw);
    expect(storage.values.get(portfolioBackupStorageKey)).toBe(raw);

    storage.values.set(portfolioStorageKey, `${raw} `);
    loadPortfolioDetailed(storage, testCurriculum);
    expect(storage.values.get(portfolioBackupStorageKey)).toBe(raw);
  });

  it("does not replace unreadable v2 data when no copy can be kept", () => {
    const values = new Map([[portfolioStorageKey, "{"]]);
    const loaded = loadPortfolioDetailed({
      getItem: (key) => values.get(key) ?? null,
      setItem: () => { throw new Error("quota"); },
      removeItem: () => undefined,
    }, testCurriculum);

    expect(loaded).toMatchObject({ normalizationStatus: "blocked", automaticPersistenceEnabled: false });
    expect(values.get(portfolioStorageKey)).toBe("{");
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
