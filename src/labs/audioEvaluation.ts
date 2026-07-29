import type {
  AudioProvenance,
  AudioSelectionAnalysis,
  FrameAnalysis,
  QueueStatus,
  TemporalHypotheses,
} from "../audio";
import type { LabEvaluation, ObservableRecord, TracePoint } from "./types";
import {
  finiteLabel,
  formatAnalysisSettings,
  hypothesis,
  meanFinite,
  observed,
  selectMeterHypotheses,
} from "./audioEvaluationSupport";

export type AudioEvaluationSettings = Readonly<{
  onsetSensitivity?: number;
  meterBias?: "mixed" | "duple" | "triple";
}>;

type ChordHypothesis = Readonly<{
  label: string;
  confidence: number;
}>;

function chordHypothesisObservables(candidates: readonly ChordHypothesis[]): ObservableRecord[] {
  return candidates.slice(0, 3).map((candidate, index) =>
    hypothesis(`chord${index + 1}`, `Chord hypothesis ${index + 1}`, `${candidate.label} · ${candidate.confidence.toFixed(2)}`),
  );
}

export function selectionToLabEvaluation(
  analysis: AudioSelectionAnalysis,
  provenance: AudioProvenance,
  settings: AudioEvaluationSettings = {},
): LabEvaluation {
  const frameCount = analysis.frames.length;
  const meanDbfs = meanFinite(analysis.frames.map((frame) => frame.level.dbfs));
  const meanCentroid = meanFinite(analysis.frames.map((frame) => frame.spectral.centroidHz));
  const meanFlatness = meanFinite(analysis.frames.map((frame) => frame.spectral.flatness));
  const meanRolloff = meanFinite(analysis.frames.map((frame) => frame.spectral.rolloffHz));
  const meanHarmonicity = meanFinite(analysis.frames.map((frame) => frame.spectral.harmonicity));
  const pitchFrames = analysis.frames.filter((frame) => frame.pitch.frequencyHz !== null && frame.pitch.confidence >= 0.6);
  const meanPitch = meanFinite(pitchFrames.flatMap((frame) => frame.pitch.frequencyHz === null ? [] : [frame.pitch.frequencyHz]));
  const topTempo = analysis.tempoHypotheses.at(0);
  const topMeter = selectMeterHypotheses(analysis.meterHypotheses, settings.meterBias).at(0);
  const observables: ObservableRecord[] = [
    observed("meanDbfs", "Mean frame level", finiteLabel(meanDbfs, 1), "dBFS"),
    observed("noiseFloor", "Estimated noise floor", finiteLabel(analysis.estimatedNoiseFloorDbfs, 1), "dBFS"),
    observed("centroid", "Mean spectral centroid", finiteLabel(meanCentroid, 1), "Hz"),
    observed("flatness", "Mean spectral flatness", finiteLabel(meanFlatness, 3), null),
    observed("rolloff", "Mean 85% roll-off", finiteLabel(meanRolloff, 1), "Hz"),
    observed("harmonicity", "Mean harmonicity", finiteLabel(meanHarmonicity, 3), null),
    hypothesis("pitch", "Monophonic pitch candidate", meanPitch === null ? "insufficient periodic evidence" : `${meanPitch.toFixed(2)} Hz`),
    hypothesis("tempo1", "Tempo candidate 1", topTempo ? `${topTempo.bpm.toFixed(1)} BPM · ${topTempo.confidence.toFixed(2)}` : "no stable candidate"),
    hypothesis("meter1", "Meter candidate 1", topMeter ? `${topMeter.beatsPerBar} beats · ${topMeter.confidence.toFixed(2)}` : "no stable candidate"),
    ...chordHypothesisObservables(analysis.chordHypotheses),
  ];
  const trace = analysis.waveform.flatMap((point, index): TracePoint[] => [
    { x: point.startSample / analysis.sampleRateHz, y: point.minimum, series: "Waveform minimum" },
    { x: point.startSample / analysis.sampleRateHz, y: point.maximum, series: "Waveform maximum" },
    ...(index < analysis.spectralFlux.length
      ? [{ x: point.startSample / analysis.sampleRateHz, y: analysis.spectralFlux[index], series: "Spectral flux" }]
      : []),
  ]);
  return {
    headline: "Local audio observation",
    result: `${frameCount} frames · ${analysis.onsetTimesSeconds.length} onset candidates`,
    observables,
    trace,
    traceAxes: {
      x: { label: "Time", unit: "s" },
      y: { label: "Waveform amplitude or spectral flux", unit: null },
    },
    visualKind: "spectrum",
    annotation: "Features describe only the bounded selected segment. Tempo, meter, pitch, and chord labels are hypotheses to check; levels remain uncalibrated.",
    provenance: {
      source: provenance.source,
      calibration: "uncalibrated",
      method: `Browser decode → mono bounded segment → Hann frames → local Web Worker FFT and feature analysis${formatAnalysisSettings(settings)}; raw audio discarded after analysis`,
      sampleRateHz: analysis.sampleRateHz,
      frameSize: analysis.frameSize,
      hopSize: analysis.hopSize,
      droppedFrames: 0,
    },
  };
}

export function microphoneFrameToLabEvaluation(
  frame: FrameAnalysis,
  temporal: TemporalHypotheses,
  queue: QueueStatus,
  settings: AudioEvaluationSettings = {},
): LabEvaluation {
  const topTempo = temporal.tempoHypotheses.at(0);
  const topMeter = selectMeterHypotheses(temporal.meterHypotheses, settings.meterBias).at(0);
  const stride = Math.max(1, Math.ceil(frame.spectrum.magnitudes.length / 128));
  const trace = Array.from(frame.spectrum.magnitudes).flatMap((magnitude, index): TracePoint[] =>
    index % stride === 0
      ? [{ x: frame.spectrum.frequenciesHz[index], y: magnitude, series: "Magnitude spectrum" }]
      : [],
  );
  const droppedFrames = queue.staleFrames + queue.overflowFrames + queue.sequenceGaps;
  return {
    headline: "Live local observation",
    result: frame.pitch.frequencyHz === null
      ? `${frame.level.dbfs.toFixed(1)} dBFS · no stable pitch candidate`
      : `${frame.pitch.frequencyHz.toFixed(1)} Hz · confidence ${frame.pitch.confidence.toFixed(2)}`,
    observables: [
      observed("dbfs", "Frame level", finiteLabel(frame.level.dbfs, 1), "dBFS"),
      observed("clipping", "Clipped-sample ratio", frame.level.clippedSampleRatio, null),
      observed("centroid", "Spectral centroid", frame.spectral.centroidHz, "Hz"),
      observed("flatness", "Spectral flatness", frame.spectral.flatness, null),
      observed("rolloff", "85% roll-off", frame.spectral.rolloffHz, "Hz"),
      observed("harmonicity", "Harmonicity", frame.spectral.harmonicity, null),
      hypothesis("pitch", "Monophonic pitch candidate", frame.pitch.frequencyHz === null ? "none" : `${frame.pitch.frequencyHz.toFixed(2)} Hz · ${frame.pitch.confidence.toFixed(2)}`),
      hypothesis("tempo", "Tempo candidate", topTempo ? `${topTempo.bpm.toFixed(1)} BPM · ${topTempo.confidence.toFixed(2)}` : "collecting evidence"),
      hypothesis("meter", "Meter candidate", topMeter ? `${topMeter.beatsPerBar} beats · ${topMeter.confidence.toFixed(2)}` : "collecting evidence"),
      ...chordHypothesisObservables(frame.chordHypotheses),
    ],
    trace,
    traceAxes: {
      x: { label: "Frequency", unit: "Hz" },
      y: { label: "Spectrum magnitude", unit: null },
    },
    visualKind: "spectrum",
    annotation: "Live frames travel directly from AudioWorklet to a bounded Web Worker. Gaps are reported; no raw frame enters learning storage.",
    provenance: {
      source: "microphone",
      calibration: "uncalibrated",
      method: `AudioWorklet → bounded credit queue → local Web Worker${formatAnalysisSettings(settings)}; processing constraints requested off`,
      sampleRateHz: frame.spectrum.sampleRateHz,
      frameSize: frame.spectrum.fftSize,
      hopSize: frame.spectrum.fftSize / 2,
      droppedFrames,
    },
  };
}
