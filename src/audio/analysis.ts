import {
  AUDIO_ANALYSIS_LIMITS,
  assertSupportedFrameSize,
  sampleRateValidationError,
  selectionDurationValidationError,
  type AudioFrame,
} from "./contracts";
import {
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
  type LevelFeatures,
  type PitchEstimate,
  type WaveformEnvelopePoint,
} from "./features";
import {
  rankChordHypotheses,
  rankMeterHypotheses,
  rankTempoHypotheses,
  type ChordHypothesis,
  type MeterHypothesis,
  type TempoHypothesis,
} from "./hypotheses";
import type { Spectrum, SpectrumAnalyzer } from "./spectrum";

export type FrameAnalysis = Readonly<{
  sequence: number;
  startSeconds: number;
  droppedBefore: number;
  calibration: "uncalibrated";
  level: LevelFeatures;
  spectrum: Spectrum;
  spectral: Readonly<{
    centroidHz: number;
    flatness: number;
    rolloffHz: number;
    harmonicity: number;
  }>;
  pitch: PitchEstimate;
  chroma: Float64Array;
  chordHypotheses: readonly ChordHypothesis[];
}>;

export type AudioSelectionAnalysis = Readonly<{
  calibration: "uncalibrated";
  sampleRateHz: number;
  frameSize: 2048 | 4096;
  hopSize: number;
  durationSeconds: number;
  waveform: readonly WaveformEnvelopePoint[];
  estimatedNoiseFloorDbfs: number;
  frames: readonly FrameAnalysis[];
  spectralFlux: readonly number[];
  onsetTimesSeconds: readonly number[];
  tempoHypotheses: readonly TempoHypothesis[];
  meterHypotheses: readonly MeterHypothesis[];
  chordHypotheses: readonly ChordHypothesis[];
}>;

export type AudioSelectionAnalysisOptions = Readonly<{
  frameSize?: 2048 | 4096;
  onsetSensitivity?: number;
}>;

export type TemporalHypotheses = Readonly<{
  onsetTimesSeconds: readonly number[];
  tempoHypotheses: readonly TempoHypothesis[];
  meterHypotheses: readonly MeterHypothesis[];
}>;

export function analyzeAudioFrame(frame: AudioFrame, analyzeSpectrum: SpectrumAnalyzer): FrameAnalysis {
  if (frame.samples.length === 0) throw new RangeError("audio frame must contain samples");
  if (!Number.isFinite(frame.sampleRateHz) || frame.sampleRateHz <= 0) {
    throw new RangeError("frame.sampleRateHz must be positive and finite");
  }
  if (!Number.isSafeInteger(frame.startSample) || frame.startSample < 0) {
    throw new RangeError("frame.startSample must be a non-negative safe integer");
  }
  const level = analyzeLevel(frame.samples);
  const spectrum = analyzeSpectrum(frame.samples, frame.sampleRateHz);
  const pitch = estimatePitchYin(frame.samples, frame.sampleRateHz);
  const chroma = chromaFromSpectrum(spectrum);
  return Object.freeze({
    sequence: frame.sequence,
    startSeconds: frame.startSample / frame.sampleRateHz,
    droppedBefore: frame.droppedBefore,
    calibration: "uncalibrated",
    level,
    spectrum,
    spectral: Object.freeze({
      centroidHz: spectralCentroidHz(spectrum),
      flatness: spectralFlatness(spectrum),
      rolloffHz: spectralRolloffHz(spectrum),
      harmonicity: spectralHarmonicity(spectrum, pitch.frequencyHz),
    }),
    pitch,
    chroma,
    chordHypotheses: rankChordHypotheses(chroma),
  });
}

/**
 * Deterministic offline analysis for an already bounded, mono selection.
 * The caller supplies the FFT boundary, which keeps this pure and testable.
 * Browser callers must run this function in the analysis worker, never on the
 * UI thread.
 */
export function analyzeAudioSelection(
  samples: ArrayLike<number>,
  sampleRateHz: number,
  analyzeSpectrum: SpectrumAnalyzer,
  options: AudioSelectionAnalysisOptions = {},
): AudioSelectionAnalysis {
  const sampleRateError = sampleRateValidationError(sampleRateHz);
  if (sampleRateError) throw sampleRateError;
  const frameSize = options.frameSize ?? 2048;
  assertSupportedFrameSize(frameSize);
  const durationError = selectionDurationValidationError(samples.length, sampleRateHz);
  if (durationError) throw durationError;
  if (samples.length < frameSize) {
    throw new RangeError(`audio selection must contain at least ${frameSize} samples`);
  }

  const hopSize = Math.round(frameSize * (1 - AUDIO_ANALYSIS_LIMITS.overlapRatio));
  const frames: FrameAnalysis[] = [];
  for (let startSample = 0, sequence = 0; startSample + frameSize <= samples.length; startSample += hopSize, sequence += 1) {
    const frameSamples = Float32Array.from(
      { length: frameSize },
      (_, index) => samples[startSample + index],
    );
    frames.push(analyzeAudioFrame({
      sequence,
      startSample,
      sampleRateHz,
      samples: frameSamples,
      droppedBefore: 0,
    }, analyzeSpectrum));
  }

  const flux = frames.map((frame, index) => index === 0
    ? 0
    : spectralFlux(frame.spectrum.magnitudes, frames[index - 1].spectrum.magnitudes));
  const temporal = analyzeFluxHistory(flux, sampleRateHz, hopSize, options.onsetSensitivity);
  const meanChroma = new Float64Array(12);
  for (const frame of frames) {
    for (let pitchClass = 0; pitchClass < meanChroma.length; pitchClass += 1) {
      meanChroma[pitchClass] += frame.chroma[pitchClass] / frames.length;
    }
  }

  return Object.freeze({
    calibration: "uncalibrated" as const,
    sampleRateHz,
    frameSize,
    hopSize,
    durationSeconds: samples.length / sampleRateHz,
    waveform: Object.freeze(waveformEnvelope(samples)),
    estimatedNoiseFloorDbfs: estimateNoiseFloorDbfs(samples),
    frames: Object.freeze(frames),
    spectralFlux: Object.freeze(flux),
    onsetTimesSeconds: temporal.onsetTimesSeconds,
    tempoHypotheses: temporal.tempoHypotheses,
    meterHypotheses: temporal.meterHypotheses,
    chordHypotheses: Object.freeze(rankChordHypotheses(meanChroma)),
  });
}

export function analyzeFluxHistory(
  flux: readonly number[],
  sampleRateHz: number,
  hopSize: number,
  onsetSensitivity?: number,
): TemporalHypotheses {
  const onsetTimesSeconds = detectFluxOnsets(flux, sampleRateHz, hopSize, {
    sensitivity: onsetSensitivity,
  });
  const tempoHypotheses = rankTempoHypotheses(flux, sampleRateHz, hopSize);
  const strongestTempo = tempoHypotheses[0];
  const beatStrengths = strongestTempo
    ? sampleBeatStrengths(flux, strongestTempo.lagFrames)
    : [];
  return Object.freeze({
    onsetTimesSeconds: Object.freeze(onsetTimesSeconds),
    tempoHypotheses: Object.freeze(tempoHypotheses),
    meterHypotheses: Object.freeze(rankMeterHypotheses(beatStrengths)),
  });
}

function sampleBeatStrengths(flux: readonly number[], lagFrames: number): number[] {
  if (flux.length === 0 || lagFrames <= 0) return [];
  let phase = 0;
  for (let index = 1; index < Math.min(lagFrames, flux.length); index += 1) {
    if (flux[index] > flux[phase]) phase = index;
  }
  const strengths: number[] = [];
  for (let center = phase; center < flux.length; center += lagFrames) {
    let localMaximum = 0;
    const radius = Math.max(1, Math.floor(lagFrames / 8));
    for (let index = Math.max(0, center - radius); index <= Math.min(flux.length - 1, center + radius); index += 1) {
      localMaximum = Math.max(localMaximum, flux[index]);
    }
    strengths.push(localMaximum);
  }
  return strengths;
}
