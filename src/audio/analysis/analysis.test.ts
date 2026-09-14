/** Public pure-analysis boundary characterization. */
import { describe, expect, it } from "vitest";
import { analyzeAudioSelection, summarizeAudioSelection, type AudioSelectionAnalysis } from "./analysis";
import { analyzeSpectrumWithFftJs } from "./fftJsAdapter";
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

  it.each([2_048, 4_096] as const)("summarizes every %i-sample frame without changing full analysis", (frameSize) => {
    const sampleRateHz = 8_192;
    const samples = Float32Array.from({ length: sampleRateHz * 2 }, (_, index) => (
      0.4 * Math.sin(2 * Math.PI * 220 * index / sampleRateHz)
    ));

    const analysis = analyzeAudioSelection(samples, sampleRateHz, fixtureSpectrum, { frameSize });
    const summary = summarizeAudioSelection(analysis);

    expect(analysis.frames.length).toBeGreaterThan(0);
    expect(summary.frameCount).toBe(analysis.frames.length);
    expect(summary.means.frameLevelDbfs).toBeCloseTo(mean(analysis.frames.map(({ level }) => level.dbfs)));
    expect(summary.means.spectralCentroidHz).toBeCloseTo(mean(analysis.frames.map(({ spectral }) => spectral.centroidHz)));
    expect(summary.means.pitchHz).toBeCloseTo(220, 0);
    expect(summary.waveform).toBe(analysis.waveform);
    expect(summary.spectralFlux).toHaveLength(analysis.spectralFlux.length);
  });

  it("represents silence and pitched signals without inventing a pitch for silence", () => {
    const sampleRateHz = 8_192;
    const silence = new Float32Array(sampleRateHz);
    const pitched = Float32Array.from({ length: sampleRateHz }, (_, index) => (
      0.5 * Math.sin(2 * Math.PI * 220 * index / sampleRateHz)
    ));

    const silenceSummary = summarizeAudioSelection(analyzeAudioSelection(
      silence,
      sampleRateHz,
      analyzeSpectrumWithFftJs,
    ));
    const pitchSummary = summarizeAudioSelection(analyzeAudioSelection(
      pitched,
      sampleRateHz,
      analyzeSpectrumWithFftJs,
    ));

    expect(silenceSummary.means.pitchHz).toBeNull();
    expect(silenceSummary.means.frameLevelDbfs).toBeNull();
    expect(pitchSummary.means.pitchHz).toBeCloseTo(220, 0);
  });

  it("bounds a 30-second flux trace, preserving its real first and last frame timestamps", () => {
    const frameCount = Math.floor((30 * 48_000 - 2_048) / 1_024) + 1;
    const analysis = {
      calibration: "uncalibrated",
      sampleRateHz: 48_000,
      frameSize: 2_048,
      hopSize: 1_024,
      durationSeconds: 30,
      waveform: [],
      estimatedNoiseFloorDbfs: -80,
      frames: [],
      spectralFlux: Array.from({ length: frameCount }, (_, index) => index),
      onsetTimesSeconds: [],
      tempoHypotheses: [],
      meterHypotheses: [],
      chordHypotheses: [],
    } satisfies AudioSelectionAnalysis;

    const summary = summarizeAudioSelection(analysis);

    expect(summary.spectralFlux).toHaveLength(256);
    expect(summary.spectralFlux[0]).toEqual({ timeSeconds: 0, value: 0 });
    expect(summary.spectralFlux.at(-1)).toEqual({
      timeSeconds: (frameCount - 1) * 1_024 / 48_000,
      value: frameCount - 1,
    });
    expect(new TextEncoder().encode(JSON.stringify(summary)).byteLength).toBeLessThan(128 * 1_024);
  });
});

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
