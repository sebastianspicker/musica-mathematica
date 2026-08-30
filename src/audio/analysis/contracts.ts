export const AUDIO_ANALYSIS_LIMITS = Object.freeze({
  minimumMicrophoneSeconds: 5,
  maximumMicrophoneSeconds: 20,
  maximumFileBytes: 25 * 1024 * 1024,
  maximumDecodedSeconds: 90,
  maximumSelectionSeconds: 30,
  supportedFrameSizes: [2048, 4096] as const,
  overlapRatio: 0.5,
  defaultQueueCapacity: 4,
});

export type AudioSourceKind = "synthetic" | "microphone" | "file";

export type AnalysisRange = Readonly<{
  startSeconds: number;
  endSeconds: number;
}>;

export type SafeMediaSettings = Readonly<{
  sampleRate?: number;
  sampleSize?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
  noiseSuppression?: boolean;
  latency?: number;
}>;

export type AudioProvenance = Readonly<{
  source: AudioSourceKind;
  sampleRateHz: number;
  channelCount: number;
  decodedDurationSeconds: number;
  analyzedRange: AnalysisRange;
  calibration: "uncalibrated";
  mediaSettings?: SafeMediaSettings;
}>;

export type AudioFrame = Readonly<{
  sequence: number;
  startSample: number;
  sampleRateHz: number;
  samples: Float32Array;
  droppedBefore: number;
}>;

export type QueueStatus = Readonly<{
  accepted: boolean;
  staleFrames: number;
  overflowFrames: number;
  sequenceGaps: number;
  queuedFrames: number;
}>;

export class AudioInputError extends Error {
  readonly code:
    | "insecure-context"
    | "user-gesture-required"
    | "invalid-duration"
    | "invalid-file-type"
    | "file-too-large"
    | "decoded-audio-too-long"
    | "invalid-selection"
    | "decode-failed";

  constructor(code: AudioInputError["code"], message: string) {
    super(message);
    this.name = "AudioInputError";
    this.code = code;
  }
}

export function assertSupportedFrameSize(frameSize: number): asserts frameSize is 2048 | 4096 {
  if (!AUDIO_ANALYSIS_LIMITS.supportedFrameSizes.includes(frameSize as 2048 | 4096)) {
    throw new RangeError("frameSize must be 2048 or 4096 samples");
  }
}

export function sampleRateValidationError(sampleRateHz: number): RangeError | null {
  return Number.isFinite(sampleRateHz) && sampleRateHz > 0
    ? null
    : new RangeError("sampleRateHz must be positive and finite");
}

export function selectionDurationValidationError(
  sampleCount: number,
  sampleRateHz: number,
): RangeError | null {
  return sampleCount / sampleRateHz <= AUDIO_ANALYSIS_LIMITS.maximumSelectionSeconds
    ? null
    : new RangeError(
      `audio selection must be at most ${AUDIO_ANALYSIS_LIMITS.maximumSelectionSeconds} seconds`,
    );
}

export function validateMicrophoneDuration(durationSeconds: number): void {
  if (
    !Number.isFinite(durationSeconds)
    || durationSeconds < AUDIO_ANALYSIS_LIMITS.minimumMicrophoneSeconds
    || durationSeconds > AUDIO_ANALYSIS_LIMITS.maximumMicrophoneSeconds
  ) {
    throw new AudioInputError(
      "invalid-duration",
      `Microphone capture must last ${AUDIO_ANALYSIS_LIMITS.minimumMicrophoneSeconds}–${AUDIO_ANALYSIS_LIMITS.maximumMicrophoneSeconds} seconds.`,
    );
  }
}

export function validateAnalysisRange(range: AnalysisRange, decodedDurationSeconds: number): AnalysisRange {
  if (!isValidAnalysisRange(range, decodedDurationSeconds)) {
    throw new AudioInputError(
      "invalid-selection",
      `Select a positive range of at most ${AUDIO_ANALYSIS_LIMITS.maximumSelectionSeconds} seconds inside the decoded audio.`,
    );
  }
  return Object.freeze({ startSeconds: range.startSeconds, endSeconds: range.endSeconds });
}

function isValidAnalysisRange(range: AnalysisRange, decodedDurationSeconds: number): boolean {
  return [
    Number.isFinite(decodedDurationSeconds),
    decodedDurationSeconds > 0,
    Number.isFinite(range.startSeconds),
    Number.isFinite(range.endSeconds),
    range.startSeconds >= 0,
    range.endSeconds > range.startSeconds,
    range.endSeconds <= decodedDurationSeconds,
    range.endSeconds - range.startSeconds <= AUDIO_ANALYSIS_LIMITS.maximumSelectionSeconds,
  ].every(Boolean);
}
