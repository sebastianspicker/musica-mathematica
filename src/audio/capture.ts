import {
  AUDIO_ANALYSIS_LIMITS,
  AudioInputError,
  type SafeMediaSettings,
  validateMicrophoneDuration,
} from "./contracts";

type MediaDevicesLike = Readonly<{
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
}>;

export type MicrophoneSession = Readonly<{
  stream: MediaStream;
  settings: SafeMediaSettings;
  requestedDurationSeconds: number;
  calibration: "uncalibrated";
  stop(): void;
}>;

export type MicrophoneRequest = Readonly<{
  /** The UI must set this only inside the user's click/keyboard handler. */
  userInitiated: boolean;
  durationSeconds: number;
  secureContext?: boolean;
  mediaDevices?: MediaDevicesLike;
  scheduleStop?: (callback: () => void, milliseconds: number) => ReturnType<typeof setTimeout>;
  cancelScheduledStop?: (handle: ReturnType<typeof setTimeout>) => void;
}>;

export function sanitizeMediaTrackSettings(settings: MediaTrackSettings): SafeMediaSettings {
  const safe: {
    sampleRate?: number;
    sampleSize?: number;
    channelCount?: number;
    echoCancellation?: boolean;
    autoGainControl?: boolean;
    noiseSuppression?: boolean;
    latency?: number;
  } = {};
  if (typeof settings.sampleRate === "number") safe.sampleRate = settings.sampleRate;
  if (typeof settings.sampleSize === "number") safe.sampleSize = settings.sampleSize;
  if (typeof settings.channelCount === "number") safe.channelCount = settings.channelCount;
  if (typeof settings.echoCancellation === "boolean") safe.echoCancellation = settings.echoCancellation;
  if (typeof settings.autoGainControl === "boolean") safe.autoGainControl = settings.autoGainControl;
  if (typeof settings.noiseSuppression === "boolean") safe.noiseSuppression = settings.noiseSuppression;
  const browserAudioSettings = settings as MediaTrackSettings & { latency?: unknown };
  if (typeof browserAudioSettings.latency === "number") safe.latency = browserAudioSettings.latency;
  return Object.freeze(safe);
}

export async function startMicrophoneSession(request: MicrophoneRequest): Promise<MicrophoneSession> {
  if (!request.userInitiated) {
    throw new AudioInputError("user-gesture-required", "Microphone capture must start from a user gesture.");
  }
  const secureContext = request.secureContext ?? globalThis.isSecureContext;
  if (!secureContext) {
    throw new AudioInputError("insecure-context", "Microphone capture requires a secure browser context.");
  }
  validateMicrophoneDuration(request.durationSeconds);
  const mediaDevices = request.mediaDevices ?? globalThis.navigator?.mediaDevices;
  if (!mediaDevices?.getUserMedia) {
    throw new AudioInputError("insecure-context", "Microphone capture is not available in this browser context.");
  }

  const stream = await mediaDevices.getUserMedia({
    audio: {
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
    },
    video: false,
  });
  const audioTrack = stream.getAudioTracks()[0];
  if (!audioTrack) {
    stream.getTracks().forEach((track) => track.stop());
    throw new AudioInputError("decode-failed", "The selected media stream did not contain an audio track.");
  }
  const scheduleStop = request.scheduleStop ?? globalThis.setTimeout.bind(globalThis);
  const cancelScheduledStop = request.cancelScheduledStop ?? globalThis.clearTimeout.bind(globalThis);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer !== undefined) cancelScheduledStop(timer);
    stream.getTracks().forEach((track) => track.stop());
  };
  timer = scheduleStop(stop, Math.min(request.durationSeconds, AUDIO_ANALYSIS_LIMITS.maximumMicrophoneSeconds) * 1000);
  return Object.freeze({
    stream,
    settings: sanitizeMediaTrackSettings(audioTrack.getSettings()),
    requestedDurationSeconds: request.durationSeconds,
    calibration: "uncalibrated" as const,
    stop,
  });
}
