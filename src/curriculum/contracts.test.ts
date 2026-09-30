import { describe, expect, it } from "vitest";
import { audioAnalysisFactors, audioAnalysisSettings, seedForTrial, type FactorDefinition, type LessonDefinition } from "./contracts";

const threshold: FactorDefinition = {
  id: "threshold", kind: "number", label: "Threshold", min: 0, max: 1, step: 0.1, defaultValue: 0.5, help: "Test.", audioSetting: "onsetSensitivity",
};
const bias: FactorDefinition = {
  id: "bias", kind: "select", label: "Bias", defaultValue: "mixed", help: "Test.", audioSetting: "meterBias",
  options: [{ value: "mixed", label: "Mixed" }, { value: "duple", label: "Duple" }],
};
const plain: FactorDefinition = { id: "tempo", kind: "number", label: "Tempo", min: 0, max: 1, step: 0.1, defaultValue: 0.5, help: "Test." };

const lessonWith = (seed?: string): LessonDefinition => (
  { protocol: { id: "p", deterministic: true, durationSeconds: 1, ...(seed ? { seed } : {}) } } as LessonDefinition
);

describe("seedForTrial", () => {
  it("uses the named factor's value for a factor seed", () => {
    expect(seedForTrial(lessonWith("factor:seed"), { seed: 7 })).toBe("7");
    expect(seedForTrial(lessonWith("factor:seed"), { seed: "abc" })).toBe("abc");
  });

  it("reports an unspecified seed when the factor is missing", () => {
    expect(seedForTrial(lessonWith("factor:seed"), {})).toBe("unspecified");
  });

  it("returns a literal seed or unspecified otherwise", () => {
    expect(seedForTrial(lessonWith("fixed"), { fixed: 1 })).toBe("fixed");
    expect(seedForTrial(lessonWith(), {})).toBe("unspecified");
  });
});

describe("audio analysis factors", () => {
  it("are exactly the factors that declare an audio setting", () => {
    expect(audioAnalysisFactors({ factors: [plain, threshold, bias] }).map((factor) => factor.id)).toEqual(["threshold", "bias"]);
    expect(audioAnalysisFactors({ factors: [plain] })).toEqual([]);
  });

  it("map factor values onto analysis settings", () => {
    const lesson = { factors: [plain, threshold, bias] };
    expect(audioAnalysisSettings(lesson, { tempo: 1, threshold: 0.3, bias: "duple" })).toEqual({ onsetSensitivity: 0.3, meterBias: "duple" });
    expect(audioAnalysisSettings(lesson, { threshold: "x", bias: "other" })).toEqual({});
    expect(audioAnalysisSettings({ factors: [plain] }, { tempo: 1 })).toEqual({});
  });
});
