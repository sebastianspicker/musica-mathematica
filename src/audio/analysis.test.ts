import { describe, expect, it } from "vitest";
import { analyzeAudioSelection } from "./analysis";
import type { SpectrumAnalyzer } from "./spectrum";

const fixtureSpectrum: SpectrumAnalyzer = (samples, sampleRateHz) => {
  const fftSize = samples.length;
  const binCount = fftSize / 2 + 1;
  const binWidthHz = sampleRateHz / fftSize;
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) peak = Math.max(peak, Math.abs(samples[index]));
  const magnitudes = new Float64Array(binCount);
  for (const [frequencyHz, weight] of [[262, 1], [330, 0.8], [392, 0.7]] as const) {
    magnitudes[Math.round(frequencyHz / binWidthHz)] = peak * weight;
  }
  return {
    fftSize,
    sampleRateHz,
    binWidthHz,
    frequenciesHz: Float64Array.from({ length: binCount }, (_, bin) => bin * binWidthHz),
    magnitudes,
    powers: Float64Array.from(magnitudes, (magnitude) => magnitude * magnitude),
  };
};

describe("bounded selection analysis", () => {
  it("produces waveform, spectral, onset, tempo, meter, and chord alternatives from a generated fixture", () => {
    const sampleRateHz = 4_096;
    const samples = new Float32Array(sampleRateHz * 8);
    for (let sample = sampleRateHz; sample < samples.length; sample += sampleRateHz) samples[sample] = 0.8;

    const result = analyzeAudioSelection(samples, sampleRateHz, fixtureSpectrum, {
      frameSize: 2_048,
      onsetSensitivity: 0.1,
    });

    expect(result).toMatchObject({
      calibration: "uncalibrated",
      sampleRateHz,
      frameSize: 2_048,
      hopSize: 1_024,
      durationSeconds: 8,
    });
    expect(result.waveform.length).toBeLessThanOrEqual(256);
    expect(result.frames).toHaveLength(31);
    expect(result.spectralFlux).toHaveLength(result.frames.length);
    expect(result.onsetTimesSeconds.length).toBeGreaterThan(3);
    expect(result.tempoHypotheses[0].bpm).toBeCloseTo(60);
    expect(result.meterHypotheses.length).toBeGreaterThan(0);
    expect(result.chordHypotheses).toHaveLength(3);
    expect(result.chordHypotheses[0]).toMatchObject({ rootPitchClass: 0, quality: "major" });
  });

  it("enforces the published selection and frame bounds", () => {
    expect(() => analyzeAudioSelection(new Float32Array(1_024), 48_000, fixtureSpectrum)).toThrow("at least 2048");
    expect(() => analyzeAudioSelection(new Float32Array(31 * 2_048), 2_048, fixtureSpectrum)).toThrow("at most 30 seconds");
  });
});
