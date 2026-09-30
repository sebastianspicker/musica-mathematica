import { describe, expect, it } from "vitest";
import * as constants from "./constants";

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

  it("pins the legacy lesson mapping", () => {
    expect(constants.legacyLessonMapping).toEqual({
      "lock-in": "lock-in-and-order",
      latency: "delay-jitter-topology",
      "low-latency-route": "delay-jitter-topology",
      "diagnose-instability": "delay-jitter-topology",
      click: "external-pulse-or-peer-adaptation",
      "click-or-peer-coupling": "external-pulse-or-peer-adaptation",
      "compose-with-latency": "external-pulse-or-peer-adaptation",
    });
  });
});
