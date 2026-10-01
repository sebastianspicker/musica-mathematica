import { describe, expect, it } from "vitest";
import { createAttemptV2, createPortfolio, updateAttempt } from "./aggregate";
import { exportPortfolioJson } from "./repository";
import { testCurriculum } from "./curriculumFixture.test-helper";
import * as schema from "./schema";

it("keeps the v2 golden field names and schema version", () => {
  const attempt = createAttemptV2(
    testCurriculum,
    "phase-proportion",
    "from-bpm-to-period",
    "2026-08-28T10:00:00.000Z",
  );
  const portfolio = updateAttempt(testCurriculum, createPortfolio(testCurriculum), attempt);
  const golden = {
    version: 2,
    active: { labId: "phase-proportion", lessonId: "from-bpm-to-period" },
    attempts: {
      "phase-proportion:from-bpm-to-period": {
        version: 2,
        labId: "phase-proportion",
        lessonId: "from-bpm-to-period",
        stage: "orient",
        trials: [],
        updatedAt: "2026-08-28T10:00:00.000Z",
      },
    },
  };

  expect(exportPortfolioJson(portfolio, testCurriculum)).toBe(JSON.stringify(golden));
});

describe("portfolio constants", () => {
  it("pins the literal storage keys, caps and trace tiers", () => {
    expect(schema.portfolioStorageKey).toBe("musicaMathematica.learning.v2");
    expect(schema.legacyPortfolioStorageKey).toBe("ensembleCouplingLab.learning.v1");
    expect(schema.maximumTrialsPerLesson).toBe(12);
    expect(schema.maximumTracePointsPerTrial).toBe(256);
    expect(schema.maximumObservablesPerTrial).toBe(24);
    expect(schema.maximumExtensionFactorsPerTrial).toBe(16);
    expect(schema.maximumResponseCodePoints).toBe(16384);
    expect(schema.maximumLongValueCodePoints).toBe(1024);
    expect(schema.maximumExtensionFactorCodePoints).toBe(512);
    expect(schema.maximumLabelCodePoints).toBe(256);
    expect(schema.maximumPortfolioJsonBytes).toBe(4_194_304);
    expect(schema.maximumRawPortfolioJsonBytes).toBe(8_388_608);
    expect([...schema.traceCompactionTiers]).toEqual([128, 64, 32, 16, 0]);
  });
});
