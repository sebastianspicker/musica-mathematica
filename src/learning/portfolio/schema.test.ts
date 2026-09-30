import { describe, expect, it } from "vitest";
import { createAttemptV2, createPortfolio, updateAttempt } from "./aggregate";
import { exportPortfolioJson } from "./repository";
import { testCurriculum } from "./curriculumFixture.test-helper";
import * as constants from "./schema";

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
    expect(constants.portfolioStorageKey).toBe("musicaMathematica.learning.v2");
    expect(constants.legacyPortfolioStorageKey).toBe("ensembleCouplingLab.learning.v1");
    expect(constants.maximumTrialsPerLesson).toBe(12);
    expect(constants.maximumTracePointsPerTrial).toBe(256);
    expect(constants.maximumObservablesPerTrial).toBe(24);
    expect(constants.maximumExtensionFactorsPerTrial).toBe(16);
    expect(constants.maximumResponseCodePoints).toBe(16384);
    expect(constants.maximumLongValueCodePoints).toBe(1024);
    expect(constants.maximumExtensionFactorCodePoints).toBe(512);
    expect(constants.maximumLabelCodePoints).toBe(256);
    expect(constants.maximumPortfolioJsonBytes).toBe(4_194_304);
    expect(constants.maximumRawPortfolioJsonBytes).toBe(8_388_608);
    expect([...constants.traceCompactionTiers]).toEqual([128, 64, 32, 16, 0]);
  });
});
