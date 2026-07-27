import { describe, expect, it } from "vitest";
import {
  additivePartials,
  additiveWaveSample,
  aliasFrequencyHz,
  attackDecayEnvelope,
  fourierResolution,
  idealStringModes,
  timeVaryingTimbreTrajectory,
} from "./model";

describe("timbre and acoustics model", () => {
  it("calculates ideal fixed-string modes", () => {
    const modes = idealStringModes(1, 200, 3);
    expect(modes.map(({ frequencyHz }) => frequencyHz)).toEqual([100, 200, 300]);
    expect(modes.map(({ wavelengthMeters }) => wavelengthMeters)).toEqual([2, 1, 2 / 3]);
    expect(idealStringModes(2, 200, 1)[0].frequencyHz).toBe(50);
  });

  it("builds normalized additive partials and samples them deterministically", () => {
    const partials = additivePartials(100, 4, 1);
    expect(partials.map(({ frequencyHz }) => frequencyHz)).toEqual([100, 200, 300, 400]);
    expect(partials.reduce((sum, partial) => sum + partial.amplitude, 0)).toBeCloseTo(1);
    expect(additiveWaveSample(0, partials)).toBe(0);
    expect(additiveWaveSample(0.001, partials)).toBeCloseTo(additiveWaveSample(0.001, partials));
  });

  it("exposes the sampling and window trade-off without false precision", () => {
    expect(aliasFrequencyHz(25_000, 48_000)).toBe(23_000);
    expect(aliasFrequencyHz(49_000, 48_000)).toBe(1_000);
    expect(fourierResolution(48_000, 2_048)).toEqual({
      sampleRateHz: 48_000,
      frameSize: 2_048,
      nyquistHz: 24_000,
      binWidthHz: 23.4375,
      frameDurationSeconds: 2_048 / 48_000,
      hopDurationSeconds: 1_024 / 48_000,
    });
  });

  it("produces a bounded attack-decay and time-varying centroid proxy", () => {
    expect(attackDecayEnvelope(0.05, 0.1, 0.4)).toBe(0.5);
    expect(attackDecayEnvelope(0.3, 0.1, 0.4)).toBeCloseTo(0.5);
    expect(attackDecayEnvelope(0.5, 0.1, 0.4)).toBe(0);
    const trajectory = timeVaryingTimbreTrajectory({
      fundamentalHz: 220,
      partialCount: 8,
      durationSeconds: 1,
      pointCount: 9,
      attackSeconds: 0.1,
      decaySeconds: 0.9,
      brightnessModulationHz: 1,
      brightnessModulationDepth: 0.5,
    });
    expect(trajectory).toHaveLength(9);
    expect(trajectory[0].amplitude).toBe(0);
    expect(trajectory.at(-1)?.amplitude).toBe(0);
    expect(new Set(trajectory.map(({ spectralCentroidHz }) => spectralCentroidHz)).size).toBeGreaterThan(2);
  });
});
