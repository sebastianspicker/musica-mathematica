import type { AudioProvenance, QueueStatus } from "../../audio/analysis/contracts";
import type { AudioSelectionSummary, FrameAnalysis, TemporalHypotheses } from "../../audio/analysis/analysis";
import type {
  AudioAnalysisSettings,
  EvaluationOutput,
  MeterBias,
  ObservableRecord,
  TracePoint,
} from "../../curriculum/contracts";


type ChordHypothesis = Readonly<{
  label: string;
  confidence: number;
}>;

function chordHypothesisObservables(candidates: readonly ChordHypothesis[]): ObservableRecord[] {
  return candidates.slice(0, 3).map((candidate, index) =>
    hypothesis(`chord${index + 1}`, `Chord hypothesis ${index + 1}`, `${candidate.label} · ${candidate.confidence.toFixed(2)}`),
  );
}

export function selectionToEvaluation(
  analysis: AudioSelectionSummary,
  provenance: AudioProvenance,
  settings: AudioAnalysisSettings = {},
): EvaluationOutput {
  const frameCount = analysis.frameCount;
  const topTempo = analysis.tempoHypotheses.at(0);
  const topMeter = selectMeterHypotheses(analysis.meterHypotheses, settings.meterBias).at(0);
  const observables: ObservableRecord[] = [
    observed("meanDbfs", "Mean frame level", finiteLabel(analysis.means.frameLevelDbfs, 1), "dBFS"),
    observed("noiseFloor", "Estimated noise floor", finiteLabel(analysis.estimatedNoiseFloorDbfs, 1), "dBFS"),
    observed("centroid", "Mean spectral centroid", finiteLabel(analysis.means.spectralCentroidHz, 1), "Hz"),
    observed("flatness", "Mean spectral flatness", finiteLabel(analysis.means.spectralFlatness, 3), null),
    observed("rolloff", "Mean 85% roll-off", finiteLabel(analysis.means.spectralRolloffHz, 1), "Hz"),
    observed("harmonicity", "Mean harmonicity", finiteLabel(analysis.means.spectralHarmonicity, 3), null),
    hypothesis("pitch", "Monophonic pitch candidate", analysis.means.pitchHz === null ? "insufficient periodic evidence" : `${analysis.means.pitchHz.toFixed(2)} Hz`),
    hypothesis("tempo1", "Tempo candidate 1", topTempo ? `${topTempo.bpm.toFixed(1)} BPM · ${topTempo.confidence.toFixed(2)}` : "no stable candidate"),
    hypothesis("meter1", "Meter candidate 1", topMeter ? `${topMeter.beatsPerBar} beats · ${topMeter.confidence.toFixed(2)}` : "no stable candidate"),
    ...chordHypothesisObservables(analysis.chordHypotheses),
  ];
  const trace = analysis.waveform.flatMap((point): TracePoint[] => [
    { x: point.startSample / analysis.sampleRateHz, y: point.minimum, series: "Waveform minimum" },
    { x: point.startSample / analysis.sampleRateHz, y: point.maximum, series: "Waveform maximum" },
  ]).concat(analysis.spectralFlux.map((point): TracePoint => ({
    x: point.timeSeconds,
    y: point.value,
    series: "Spectral flux",
  })));
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

export function microphoneFrameToEvaluation(
  frame: FrameAnalysis,
  temporal: TemporalHypotheses,
  queue: QueueStatus,
  settings: AudioAnalysisSettings = {},
): EvaluationOutput {
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

type MeterHypotheses = TemporalHypotheses["meterHypotheses"];
type MeterHypothesis = MeterHypotheses[number];

function formatAnalysisSettings(settings: AudioAnalysisSettings): string {
  const parts = [
    ...(settings.onsetSensitivity === undefined ? [] : [`onset sensitivity ${settings.onsetSensitivity.toFixed(2)}`]),
    ...(settings.meterBias === undefined ? [] : [`meter family ${settings.meterBias}`]),
  ];
  return parts.length === 0 ? "" : ` (${parts.join(", ")})`;
}

function observed(id: string, label: string, value: number | string, unit: string | null): ObservableRecord {
  return { id, label, value, unit, aggregation: "distribution", claimId: "measurement.local", precision: 3 };
}

function hypothesis(id: string, label: string, value: string): ObservableRecord {
  return { id, label, value, unit: null, aggregation: "distribution", claimId: "hypothesis.transcription" };
}

function finiteLabel(value: number | null, precision: number): string {
  return value === null || !Number.isFinite(value) ? "below numerical floor" : value.toFixed(precision);
}

function selectMeterHypotheses(hypotheses: MeterHypotheses, bias: MeterBias | undefined): MeterHypotheses {
  if (bias === undefined || bias === "mixed") return hypotheses;
  const divisor = bias === "duple" ? 2 : 3;
  return hypotheses.filter((candidate: MeterHypothesis) => candidate.beatsPerBar % divisor === 0);
}
