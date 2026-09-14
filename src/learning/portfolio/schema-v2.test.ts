import { expect, it } from "vitest";
import { createAttemptV2, createPortfolio, updateAttempt } from "./aggregate";
import { exportPortfolioJson } from "./repository";
import { testCurriculum } from "./testReader";

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
