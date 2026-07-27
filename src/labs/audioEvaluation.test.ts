import { describe, expect, it } from "vitest";
import type { FrameAnalysis, TemporalHypotheses } from "../audio/analysis";
import type { QueueStatus } from "../audio/contracts";
import { microphoneFrameToLabEvaluation } from "./audioEvaluation";

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

describe("audio-to-lab provenance", () => {
  it("uses cumulative queue counters without double-counting frame gaps", () => {
    const evaluation = microphoneFrameToLabEvaluation(frame, temporal, queue);

    expect(evaluation.provenance.droppedFrames).toBe(7);
    expect(evaluation.traceAxes).toEqual({
      x: { label: "Frequency", unit: "Hz" },
      y: { label: "Spectrum magnitude", unit: null },
    });
  });

  it("applies and records the lesson's onset and candidate-family settings", () => {
    const evaluation = microphoneFrameToLabEvaluation(frame, temporal, queue, {
      onsetSensitivity: 0.35,
      meterBias: "triple",
    });

    expect(evaluation.observables.find(({ id }) => id === "meter")?.value).toContain("3 beats");
    expect(evaluation.provenance.method).toContain("onset sensitivity 0.35");
    expect(evaluation.provenance.method).toContain("meter family triple");
  });

  it("rejects incompatible meter candidates before selecting the family leader", () => {
    const evaluation = microphoneFrameToLabEvaluation(frame, {
      ...temporal,
      meterHypotheses: [
        { beatsPerBar: 3, confidence: 0.9, label: "meter hypothesis" },
        { beatsPerBar: 2, confidence: 0.6, label: "meter hypothesis" },
      ],
    }, queue, { meterBias: "duple" });

    expect(evaluation.observables.find(({ id }) => id === "meter")?.value).toContain("2 beats");
  });
});
