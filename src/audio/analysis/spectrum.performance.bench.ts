import { afterAll, bench, describe } from "vitest";
import { summarizeAudioSelection, type AudioSelectionAnalysis, type FrameAnalysis } from "./analysis";
import { analyzeSpectrumWithFftJs } from "./fftJsAdapter";

const FRAME_SIZES = [2_048, 4_096] as const;
const BATCH_SIZE = 128;
const measurements = new Map<number, number[]>();

function fixture(size: number): Float32Array {
  return Float32Array.from({ length: size }, (_, index) => (
    0.45 * Math.sin(2 * Math.PI * 17 * index / size)
    + 0.2 * Math.sin(2 * Math.PI * 43 * index / size)
  ));
}

function percentile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? 0;
}

describe("warmed spectrum analysis", () => {
  for (const frameSize of FRAME_SIZES) {
    const samples = fixture(frameSize);
    const durations: number[] = [];
    measurements.set(frameSize, durations);

    bench(`FFT/Hann ${frameSize}`, () => {
      const started = performance.now();
      for (let iteration = 0; iteration < BATCH_SIZE; iteration += 1) {
        analyzeSpectrumWithFftJs(samples, 48_000);
      }
      durations.push((performance.now() - started) / BATCH_SIZE);
    }, {
      iterations: 15,
      time: 0,
      warmupIterations: 3,
      warmupTime: 0,
    });
  }
});

afterAll(() => {
  for (const frameSize of FRAME_SIZES) {
    // Tinybench also invokes the callback during calibration and warmup.
    const sorted = (measurements.get(frameSize) ?? []).slice(-15).sort((left, right) => left - right);
    console.info(JSON.stringify({
      benchmark: "warmed-spectrum-analysis",
      frameSize,
      batchSize: BATCH_SIZE,
      samples: sorted.length,
      medianMillisecondsPerFrame: percentile(sorted, 0.5),
      p95MillisecondsPerFrame: percentile(sorted, 0.95),
    }));
  }
  console.info(JSON.stringify(thirtySecondPayloadEvidence()));
});

function thirtySecondPayloadEvidence() {
  const sampleRateHz = 48_000;
  const frameSize = 2_048;
  const hopSize = 1_024;
  const frameCount = Math.floor((30 * sampleRateHz - frameSize) / hopSize) + 1;
  const binCount = frameSize / 2 + 1;
  const spectrum = {
    fftSize: frameSize,
    sampleRateHz,
    binWidthHz: sampleRateHz / frameSize,
    frequenciesHz: new Float64Array(binCount),
    magnitudes: new Float64Array(binCount),
    powers: new Float64Array(binCount),
  };
  const frame: FrameAnalysis = {
    sequence: 0,
    startSeconds: 0,
    droppedBefore: 0,
    calibration: "uncalibrated",
    level: { rms: 0.1, dbfs: -20, peak: 0.2, clippedSampleRatio: 0, silent: false },
    spectrum,
    spectral: { centroidHz: 500, flatness: 0.2, rolloffHz: 1_200, harmonicity: 0.7 },
    pitch: { frequencyHz: 220, confidence: 0.8, periodSamples: 218 },
    chroma: new Float64Array(12),
    chordHypotheses: [],
  };
  const analysis: AudioSelectionAnalysis = {
    calibration: "uncalibrated",
    sampleRateHz,
    frameSize,
    hopSize,
    durationSeconds: 30,
    waveform: Array.from({ length: 256 }, (_, index) => ({
      startSample: index * 5_625,
      endSampleExclusive: (index + 1) * 5_625,
      minimum: -0.5,
      maximum: 0.5,
      rms: 0.2,
    })),
    estimatedNoiseFloorDbfs: -60,
    frames: Array.from({ length: frameCount }, () => frame),
    spectralFlux: Array.from({ length: frameCount }, (_, index) => index / frameCount),
    onsetTimesSeconds: Array.from({ length: Math.ceil(frameCount / 12) }, (_, index) => index * 0.25),
    tempoHypotheses: [],
    meterHypotheses: [],
    chordHypotheses: [],
  };
  const compactBytes = new TextEncoder().encode(JSON.stringify(summarizeAudioSelection(analysis))).byteLength;
  const fullTypedArrayBytesLowerBound = frameCount * (3 * binCount + 12) * Float64Array.BYTES_PER_ELEMENT
    + frameCount * Float64Array.BYTES_PER_ELEMENT;
  return {
    benchmark: "thirty-second-selection-payload",
    frameCount,
    compactJsonBytes: compactBytes,
    fullTypedArrayBytesLowerBound,
  };
}
