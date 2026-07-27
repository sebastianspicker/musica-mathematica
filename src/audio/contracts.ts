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
  const duration = range.endSeconds - range.startSeconds;
  if (
    !Number.isFinite(decodedDurationSeconds)
    || decodedDurationSeconds <= 0
    || !Number.isFinite(range.startSeconds)
    || !Number.isFinite(range.endSeconds)
    || range.startSeconds < 0
    || range.endSeconds <= range.startSeconds
    || range.endSeconds > decodedDurationSeconds
    || duration > AUDIO_ANALYSIS_LIMITS.maximumSelectionSeconds
  ) {
    throw new AudioInputError(
      "invalid-selection",
      `Select a positive range of at most ${AUDIO_ANALYSIS_LIMITS.maximumSelectionSeconds} seconds inside the decoded audio.`,
    );
  }
  return Object.freeze({ startSeconds: range.startSeconds, endSeconds: range.endSeconds });
}

export class BoundedAudioFrameQueue {
  private readonly frames: AudioFrame[] = [];
  private lastSequence: number | null = null;
  private staleFrames = 0;
  private overflowFrames = 0;
  private sequenceGaps = 0;

  constructor(private readonly capacity: number = AUDIO_ANALYSIS_LIMITS.defaultQueueCapacity) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new RangeError("capacity must be a positive safe integer");
    }
  }

  push(frame: AudioFrame): QueueStatus {
    if (!Number.isSafeInteger(frame.sequence) || frame.sequence < 0) {
      throw new RangeError("frame.sequence must be a non-negative safe integer");
    }
    if (this.lastSequence !== null && frame.sequence <= this.lastSequence) {
      this.staleFrames += 1;
      return this.status(false);
    }
    const inferredGap = this.lastSequence === null
      ? frame.sequence
      : Math.max(0, frame.sequence - this.lastSequence - 1);
    // `droppedBefore` and the sequence delta normally describe the same worklet
    // frames. Count the larger report so a known gap is visible without double
    // counting it.
    this.sequenceGaps += Math.max(inferredGap, Math.max(0, frame.droppedBefore));
    this.lastSequence = frame.sequence;
    this.frames.push(frame);
    while (this.frames.length > this.capacity) {
      this.frames.shift();
      this.overflowFrames += 1;
    }
    return this.status(true);
  }

  shift(): AudioFrame | undefined {
    return this.frames.shift();
  }

  drain(): AudioFrame[] {
    return this.frames.splice(0, this.frames.length);
  }

  getStatus(): QueueStatus {
    return this.status(true);
  }

  private status(accepted: boolean): QueueStatus {
    return Object.freeze({
      accepted,
      staleFrames: this.staleFrames,
      overflowFrames: this.overflowFrames,
      sequenceGaps: this.sequenceGaps,
      queuedFrames: this.frames.length,
    });
  }
}
