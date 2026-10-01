import { describe, expect, it } from "vitest";
import type { AudioSelectionSummary, FrameAnalysis, TemporalHypotheses } from "../../audio/analysis/analysis";
import type { QueueStatus } from "../../audio/analysis/contracts";
import { claimById } from "../../curriculum/evidence";
import { microphoneFrameToEvaluation, selectionToEvaluation } from "./mapAudioEvaluation";

const frame: FrameAnalysis = {
  sequence: 5,
  startSeconds: 1,
  droppedBefore: 4,
  calibration: "uncalibrated",
  level: { rms: 0.1, dbfs: -20, peak: 0.2, clippedSampleRatio: 0, silent: false },
  spectrum: {
    fftSize: 2048,
    sampleRateHz: 48_000,
    binWidthHz: 48_000 / 2048,
    frequenciesHz: new Float64Array([0, 48_000 / 2048]),
    magnitudes: new Float64Array([0.1, 0.5]),
    powers: new Float64Array([0.01, 0.25]),
  },
  spectral: { centroidHz: 500, flatness: 0.2, rolloffHz: 1200, harmonicity: 0.7 },
  pitch: { frequencyHz: 220, confidence: 0.8, periodSamples: 218 },
  chroma: new Float64Array(12),
  chordHypotheses: [],
};

const temporal: TemporalHypotheses = {
  onsetTimesSeconds: [],
  tempoHypotheses: [],
  meterHypotheses: [
    { beatsPerBar: 2, confidence: 0.6, label: "meter hypothesis" },
    { beatsPerBar: 3, confidence: 0.4, label: "meter hypothesis" },
  ],
};

const queue: QueueStatus = {
  accepted: true,
  staleFrames: 1,
  overflowFrames: 2,
  sequenceGaps: 4,
  queuedFrames: 0,
};

describe("audio-to-evaluation provenance", () => {
  it("uses cumulative queue counters without double-counting frame gaps", () => {
    const evaluation = microphoneFrameToEvaluation(frame, temporal, queue);

    expect(evaluation.provenance.droppedFrames).toBe(7);
    expect(evaluation.traceAxes).toEqual({
      x: { label: "Frequency", unit: "Hz" },
      y: { label: "Spectrum magnitude", unit: null },
    });
  });

  it("applies and records the lesson's onset and candidate-family settings", () => {
    const evaluation = microphoneFrameToEvaluation(frame, temporal, queue, {
      onsetSensitivity: 0.35,
      meterBias: "triple",
    });

    expect(evaluation.observables.find(({ id }) => id === "meter")?.value).toContain("3 beats");
    expect(evaluation.provenance.method).toContain("onset sensitivity 0.35");
    expect(evaluation.provenance.method).toContain("meter family triple");
  });

  it("rejects incompatible meter candidates before selecting the family leader", () => {
    const evaluation = microphoneFrameToEvaluation(frame, {
      ...temporal,
      meterHypotheses: [
        { beatsPerBar: 3, confidence: 0.9, label: "meter hypothesis" },
        { beatsPerBar: 2, confidence: 0.6, label: "meter hypothesis" },
      ],
    }, queue, { meterBias: "duple" });

    expect(evaluation.observables.find(({ id }) => id === "meter")?.value).toContain("2 beats");
  });

  it("maps compact selection means and independently timed flux into the evaluation", () => {
    const summary: AudioSelectionSummary = {
      calibration: "uncalibrated",
      sampleRateHz: 48_000,
      frameSize: 2_048,
      hopSize: 1_024,
      durationSeconds: 30,
      frameCount: 1_405,
      means: {
        frameLevelDbfs: -20,
        spectralCentroidHz: 500,
        spectralFlatness: 0.2,
        spectralRolloffHz: 1_200,
        spectralHarmonicity: 0.7,
        pitchHz: 220,
      },
      waveform: [{ startSample: 0, endSampleExclusive: 1_024, minimum: -0.5, maximum: 0.5, rms: 0.2 }],
      estimatedNoiseFloorDbfs: -60,
      spectralFlux: [{ timeSeconds: 29.952, value: 0.8 }],
      onsetTimesSeconds: [1],
      tempoHypotheses: [],
      meterHypotheses: [],
      chordHypotheses: [],
    };

    const evaluation = selectionToEvaluation(summary, {
      source: "file",
      sampleRateHz: 48_000,
      channelCount: 1,
      decodedDurationSeconds: 30,
      analyzedRange: { startSeconds: 0, endSeconds: 30 },
      calibration: "uncalibrated",
    });

    expect(evaluation.result).toBe("1405 frames · 1 onset candidates");
    expect(evaluation.observables.find(({ id }) => id === "pitch")?.value).toBe("220.00 Hz");
    expect(evaluation.trace).toContainEqual({ x: 29.952, y: 0.8, series: "Spectral flux" });
  });

  it("cites only evidence claims that exist in the registry", () => {
    const summary: AudioSelectionSummary = {
      calibration: "uncalibrated",
      sampleRateHz: 48_000,
      frameSize: 2_048,
      hopSize: 1_024,
      durationSeconds: 1,
      frameCount: 1,
      means: { frameLevelDbfs: -20, spectralCentroidHz: 500, spectralFlatness: 0.2, spectralRolloffHz: 1_200, spectralHarmonicity: 0.7, pitchHz: 220 },
      waveform: [{ startSample: 0, endSampleExclusive: 1_024, minimum: -0.5, maximum: 0.5, rms: 0.2 }],
      estimatedNoiseFloorDbfs: -60,
      spectralFlux: [{ timeSeconds: 0, value: 0.8 }],
      onsetTimesSeconds: [],
      tempoHypotheses: [],
      meterHypotheses: [],
      chordHypotheses: [],
    };
    const evaluations = [
      microphoneFrameToEvaluation(frame, temporal, queue),
      selectionToEvaluation(summary, {
        source: "file",
        sampleRateHz: 48_000,
        channelCount: 1,
        decodedDurationSeconds: 1,
        analyzedRange: { startSeconds: 0, endSeconds: 1 },
        calibration: "uncalibrated",
      }),
    ];

    for (const evaluation of evaluations) {
      expect(evaluation.observables.length).toBeGreaterThan(0);
      for (const observable of evaluation.observables) expect(claimById(observable.claimId), observable.id).toBeDefined();
    }
  });
});
