import { describe, expect, it } from "vitest";
import type { LegacyEnsembleConfig, LegacyEnsembleMetrics, LessonAttemptV1 } from "./schema";
import { migrateLessonAttemptV1 } from "./migration";
import { testCurriculum } from "../portfolio/testReader";

const timestamp = "2026-08-28T10:00:00.000Z";
const legacyMetrics: LegacyEnsembleMetrics = {
  coherence: 0.8,
  phaseSpread: 0.2,
  phaseSpreadEquivalentMs: 10,
  peerCouplingShare: 0.5,
  modelLatencyBudgetSeconds: 0.1,
  leaderToFollowerPhaseLagMs: null,
  sectionCoherences: null,
};
const legacyConfigFixture: LegacyEnsembleConfig = {
  musicianCount: 8,
  tempoBpm: 104,
  tempoSpreadBpm: 12,
  couplingStrength: 0.18,
  latencySeconds: 0.012,
  jitterSeconds: 0,
  topology: "all-to-all",
  repertoireTexture: "pulse",
  clickTrackStrength: 0,
};

function legacyAttemptFixture(lessonId: string, config: LegacyEnsembleConfig): LessonAttemptV1 {
  return {
    version: 1,
    lessonId,
    stage: "experiment",
    prediction: "A historical prediction.",
    runs: [{
      id: "Legacy run",
      durationSeconds: 1,
      config,
      metrics: {
        ...legacyMetrics,
        leaderToFollowerPhaseLagMs: config.topology === "leader-follower" ? 4 : null,
        sectionCoherences: config.topology === "sections" ? [0.8, 0.75] : null,
      },
    }],
  };
}

describe("legacy-v1 migration", () => {
  it.each([
    ["lock-in", "lock-in-and-order", { musicianCount: 8, tempoBpm: 104, tempoSpreadBpm: 12, couplingStrength: 0.18 }, legacyConfigFixture],
    ["latency", "delay-jitter-topology", { latencyMs: 75, jitterMs: 0, couplingStrength: 1.6, topology: "leader-follower" }, { ...legacyConfigFixture, tempoBpm: 132, tempoSpreadBpm: 5, couplingStrength: 1.6, latencySeconds: 0.075, topology: "leader-follower", repertoireTexture: "dense-rhythm" }],
    ["low-latency-route", "delay-jitter-topology", { latencyMs: 7.5, jitterMs: 2, couplingStrength: 1.25, topology: "all-to-all" }, { ...legacyConfigFixture, tempoBpm: 128, tempoSpreadBpm: 6, couplingStrength: 1.25, latencySeconds: 0.0075, jitterSeconds: 0.002, repertoireTexture: "dense-rhythm" }],
    ["diagnose-instability", "delay-jitter-topology", { latencyMs: 55, jitterMs: 26, couplingStrength: 0.55, topology: "leader-follower" }, { ...legacyConfigFixture, tempoBpm: 122, tempoSpreadBpm: 15, couplingStrength: 0.55, latencySeconds: 0.055, jitterSeconds: 0.026, topology: "leader-follower" }],
    ["click", "external-pulse-or-peer-adaptation", { clickTrackStrength: 2.1, couplingStrength: 0.25, tempoSpreadBpm: 10, tempoBpm: 116 }, { ...legacyConfigFixture, tempoBpm: 116, tempoSpreadBpm: 10, couplingStrength: 0.25, latencySeconds: 0.045, topology: "click-track", repertoireTexture: "call-response", clickTrackStrength: 2.1 }],
    ["click-or-peer-coupling", "external-pulse-or-peer-adaptation", { clickTrackStrength: 2.4, couplingStrength: 0.3, tempoSpreadBpm: 12, tempoBpm: 118 }, { ...legacyConfigFixture, tempoBpm: 118, tempoSpreadBpm: 12, couplingStrength: 0.3, latencySeconds: 0.035, jitterSeconds: 0.006, topology: "click-track", clickTrackStrength: 2.4 }],
    ["compose-with-latency", "external-pulse-or-peer-adaptation", { clickTrackStrength: 0, couplingStrength: 0.9, tempoSpreadBpm: 5, tempoBpm: 72 }, { ...legacyConfigFixture, tempoBpm: 72, tempoSpreadBpm: 5, couplingStrength: 0.9, latencySeconds: 0.12, jitterSeconds: 0.012, topology: "sections", repertoireTexture: "call-response" }],
  ] as const)("maps legacy lesson %s to %s with its historical factor projection", (
    legacyLessonId,
    lessonId,
    expectedFactors,
    config,
  ) => {
    const migrated = migrateLessonAttemptV1(
      legacyAttemptFixture(legacyLessonId, config as LegacyEnsembleConfig),
      testCurriculum,
      timestamp,
    );
    const trial = Object.values(migrated.attempts)[0]?.trials[0];

    expect(migrated.active.lessonId).toBe(lessonId);
    expect(trial?.factors).toEqual(expectedFactors);
    expect(trial?.protocolId).toContain(".legacy-v1");
    expect(trial?.provenance.method).toContain("ensembleCouplingLab.learning.v1");
  });

  it("uses the injected reader when a historical target is unavailable", () => {
    const readerWithoutEnsemble = {
      ...testCurriculum,
      lessonById: (domainId: string, lessonId: string) => domainId === "ensemble-dynamics"
        ? undefined
        : testCurriculum.lessonById(domainId, lessonId),
    };

    const migrated = migrateLessonAttemptV1(
      legacyAttemptFixture("lock-in", legacyConfigFixture),
      readerWithoutEnsemble,
      timestamp,
    );

    expect(migrated).toEqual({ version: 2, active: { labId: "phase-proportion", lessonId: "from-bpm-to-period" }, attempts: {} });
  });
});
