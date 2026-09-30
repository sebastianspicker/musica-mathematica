import { describe, expect, it } from "vitest";
import { defaultConfig, type EnsembleConfig } from "./config";
import { simulateEnsemble } from "./model";
import { simulateEnsembleReference } from "./model.reference.test-helper";

const stress: EnsembleConfig = {
  ...defaultConfig,
  musicianCount: 16,
  tempoBpm: 180,
  tempoSpreadBpm: 24,
  couplingStrength: 3,
  latencySeconds: 0.18,
  jitterSeconds: 0.06,
  topology: "all-to-all",
  repertoireTexture: "dense-rhythm",
  clickTrackStrength: 3,
};

describe("ensemble optimization equivalence", () => {
  it("preserves complete results after edge grouping and binary history lookup for five old-range fixtures", () => {
    const fixtures: EnsembleConfig[] = [
      defaultConfig, stress,
      { ...stress, topology: "leader-follower" },
      { ...stress, topology: "sections" },
      { ...stress, topology: "click-track" },
    ];
    // Math implementations can differ in their final floating-point bits across
    // platforms. Run both algorithms here so equality still covers every value.
    for (const config of fixtures) {
      expect(simulateEnsemble(config, 2)).toEqual(simulateEnsembleReference(config, 2));
    }
  });
});
