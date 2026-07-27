import { describe, expect, it } from "vitest";
import {
  amplitudeToDbfs,
  analyzeLevel,
  chromaFromSpectrum,
  detectFluxOnsets,
  estimateNoiseFloorDbfs,
  estimatePitchYin,
  spectralCentroidHz,
  spectralFlatness,
  spectralFlux,
  spectralHarmonicity,
  spectralRolloffHz,
  waveformEnvelope,
} from "./features";
import { rankChordHypotheses, rankMeterHypotheses, rankTempoHypotheses } from "./hypotheses";
import { analyzeAudioFrame } from "./analysis";
import { createFftJsSpectrumAnalyzer, type FftJsLike, type Spectrum } from "./spectrum";
import { applyWindow, frameAudio, hannWindow } from "./windowing";

function spectrum(frequenciesHz: number[], powers: number[]): Spectrum {
  return {
    fftSize: (frequenciesHz.length - 1) * 2,
    sampleRateHz: 8_000,
    binWidthHz: frequenciesHz[1] - frequenciesHz[0],
    frequenciesHz: Float64Array.from(frequenciesHz),
    magnitudes: Float64Array.from(powers, Math.sqrt),
    powers: Float64Array.from(powers),
  };
}

describe("audio features", () => {
  it("calculates level features in full-scale-relative units", () => {
    expect(analyzeLevel([0.5, -0.5, 0.5, -0.5])).toMatchObject({
      rms: 0.5,
      peak: 0.5,
      clippedSampleRatio: 0,
      silent: false,
    });
    expect(amplitudeToDbfs(0.5)).toBeCloseTo(-6.0206, 3);
    expect(amplitudeToDbfs(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(analyzeLevel([1, 0, -1, 0]).clippedSampleRatio).toBe(0.5);
    expect(estimateNoiseFloorDbfs([0.01, -0.01, 0.5, -0.5], 2)).toBeCloseTo(-40);
    expect(waveformEnvelope([1, -1, 0.5, -0.5], 2)).toEqual([
      { startSample: 0, endSampleExclusive: 2, minimum: -1, maximum: 1, rms: 1 },
      { startSample: 2, endSampleExclusive: 4, minimum: -0.5, maximum: 0.5, rms: 0.5 },
    ]);
  });

  it("estimates a generated monophonic sine with YIN", () => {
    const sampleRateHz = 8_000;
    const expectedHz = 200;
    const samples = Float32Array.from(
      { length: 4_096 },
      (_, index) => Math.sin(2 * Math.PI * expectedHz * index / sampleRateHz),
    );
    const pitch = estimatePitchYin(samples, sampleRateHz, { minimumHz: 80, maximumHz: 500 });
    expect(pitch.frequencyHz).toBeCloseTo(expectedHz, 0);
    expect(pitch.confidence).toBeGreaterThan(0.99);
  });

  it("derives transparent spectral summaries and chroma", () => {
    const testSpectrum = spectrum([0, 100, 200, 300, 400], [0, 4, 1, 4, 0]);
    expect(spectralCentroidHz(testSpectrum)).toBeCloseTo(200);
    expect(spectralRolloffHz(testSpectrum, 0.8)).toBe(300);
    expect(spectralFlatness(testSpectrum)).toBeGreaterThanOrEqual(0);
    expect(spectralFlatness(testSpectrum)).toBeLessThanOrEqual(1);
    expect(spectralHarmonicity(testSpectrum, 100, 10)).toBeCloseTo(1);

    const chromaSpectrum = spectrum(
      Array.from({ length: 13 }, (_, index) => index === 0 ? 0 : 440 * index),
      [0, 4, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0],
    );
    const chroma = chromaFromSpectrum(chromaSpectrum);
    expect(Array.from(chroma).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  });

  it("finds positive spectral change and local flux peaks", () => {
    expect(spectralFlux([1, 3, 2], [2, 1, 2])).toBeCloseTo(2 / 6);
    const flux = [0, 0.01, 1, 0.02, 0, 0.01, 0.8, 0.02, 0];
    expect(detectFluxOnsets(flux, 100, 10, { neighborhood: 1, sensitivity: 1 })).toEqual([0.2, 0.6]);
  });

  it("rejects incompatible spectra and invalid flux-onset settings", () => {
    expect(() => spectralFlux([1], [])).toThrow("current and previous spectra must have the same non-zero length");
    expect(() => spectralFlux([1], [Number.NaN])).toThrow("spectral magnitudes must be finite and non-negative");
    expect(() => detectFluxOnsets([], 0, 10)).toThrow("sampleRateHz and hopSize must be positive");
    expect(() => detectFluxOnsets([], 100, 10, { neighborhood: 0 })).toThrow("neighborhood must be a positive integer and sensitivity must be non-negative");
  });

  it("ranks tempo, meter, and chord alternatives as hypotheses", () => {
    const flux = Array.from({ length: 400 }, (_, index) => index % 50 === 0 ? 1 : 0);
    const tempo = rankTempoHypotheses(flux, 100, 1);
    expect(tempo[0]).toMatchObject({ bpm: 120, lagFrames: 50, label: "tempo hypothesis" });

    const meter = rankMeterHypotheses([1, 0.2, 0.2, 0.2, 1, 0.2, 0.2, 0.2, 1, 0.2, 0.2, 0.2]);
    expect(meter[0]).toMatchObject({ beatsPerBar: 4, label: "meter hypothesis" });

    const cMajor = [1, 0, 0, 0, 0.8, 0, 0, 0.7, 0, 0, 0, 0];
    const chords = rankChordHypotheses(cMajor);
    expect(chords).toHaveLength(3);
    expect(chords[0]).toMatchObject({ rootPitchClass: 0, quality: "major", label: "C major" });
  });

  it("uses Hann framing and keeps fft.js behind one adapter", () => {
    const window = hannWindow(5);
    expect(window[0]).toBe(0);
    expect(window[1]).toBeCloseTo(0.5);
    expect(window[2]).toBe(1);
    expect(window[3]).toBeCloseTo(0.5);
    expect(window[4]).toBe(0);
    expect(Array.from(applyWindow([1, 1, 1, 1, 1], window))).toEqual(Array.from(window));
    expect(frameAudio(new Float32Array(6_144), 2_048)).toHaveLength(5);

    class StubFft implements FftJsLike {
      createComplexArray(): number[] {
        return Array.from({ length: 16 }, () => 0);
      }
      realTransform(output: number[]): void {
        output[2] = 7 / 4;
      }
    }
    const analyzer = createFftJsSpectrumAnalyzer(StubFft);
    const analyzed = analyzer(new Float32Array(8).fill(1), 8_000);
    expect(analyzed.frequenciesHz[1]).toBe(1_000);
    expect(analyzed.magnitudes[1]).toBeCloseTo(1);
  });

  it("combines level, spectrum, pitch, chroma, and chord alternatives for one frame", () => {
    const sampleRateHz = 8_192;
    const samples = Float32Array.from(
      { length: 2_048 },
      (_, index) => 0.4 * Math.sin(2 * Math.PI * 256 * index / sampleRateHz),
    );
    const frameSpectrum = spectrum(
      Array.from({ length: 1_025 }, (_, index) => index * 4),
      Array.from({ length: 1_025 }, (_, index) => index === 64 || index === 80 || index === 96 ? 1 : 0),
    );
    const result = analyzeAudioFrame({
      sequence: 7,
      startSample: 4_096,
      sampleRateHz,
      samples,
      droppedBefore: 2,
    }, () => frameSpectrum);

    expect(result).toMatchObject({
      sequence: 7,
      startSeconds: 0.5,
      droppedBefore: 2,
      calibration: "uncalibrated",
    });
    expect(result.level.rms).toBeCloseTo(0.4 / Math.sqrt(2), 4);
    expect(result.pitch.frequencyHz).toBeCloseTo(256, 0);
    expect(result.chordHypotheses).toHaveLength(3);
  });
});
