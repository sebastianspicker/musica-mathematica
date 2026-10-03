import {
  AUDIO_ANALYSIS_LIMITS,
  AudioInputError,
  type AnalysisRange,
  type AudioProvenance,
  validateAnalysisRange,
} from "../analysis/contracts";

export type DecodedSelection = Readonly<{
  samples: Float32Array;
  provenance: AudioProvenance;
}>;

type AudioDecoder = Readonly<{
  decodeAudioData(audioData: ArrayBuffer): Promise<AudioBuffer>;
}>;

type AudioFile = Pick<File, "type" | "size" | "arrayBuffer">;

export type AudioMetadataProbe = (
  file: AudioFile,
  signal?: AbortSignal,
) => Promise<number>;

export type DecodeAudioSelectionOptions = Readonly<{
  metadataProbe?: AudioMetadataProbe;
  signal?: AbortSignal;
}>;

const metadataTimeoutMilliseconds = 10_000;

export function validateAudioFile(file: Pick<File, "type" | "size">): void {
  if (!file.type.toLowerCase().startsWith("audio/")) {
    throw new AudioInputError("invalid-file-type", "Choose a browser-decodable file with an audio/* media type.");
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > AUDIO_ANALYSIS_LIMITS.maximumFileBytes) {
    throw new AudioInputError(
      "file-too-large",
      `Audio files must be non-empty and no larger than ${AUDIO_ANALYSIS_LIMITS.maximumFileBytes / (1024 * 1024)} MiB.`,
    );
  }
}

export async function decodeAudioSelection(
  file: AudioFile,
  decoder: AudioDecoder,
  range: AnalysisRange,
  options: DecodeAudioSelectionOptions = {},
): Promise<DecodedSelection> {
  validateAudioFile(file);
  try {
    throwIfAborted(options.signal);
    const metadataDuration = await (options.metadataProbe ?? probeAudioDuration)(file, options.signal);
    validateDecodedDuration(metadataDuration);
    throwIfAborted(options.signal);
    const encoded = await file.arrayBuffer();
    throwIfAborted(options.signal);
    const decoded = await decoder.decodeAudioData(encoded);
    throwIfAborted(options.signal);
    validateDecodedDuration(decoded.duration);
    const validatedRange = validateAnalysisRange(range, decoded.duration);
    const startFrame = Math.floor(validatedRange.startSeconds * decoded.sampleRate);
    const endFrame = Math.min(decoded.length, Math.ceil(validatedRange.endSeconds * decoded.sampleRate));
    const samples = new Float32Array(endFrame - startFrame);
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const channelSamples = decoded.getChannelData(channel);
      for (let frame = startFrame; frame < endFrame; frame += 1) {
        samples[frame - startFrame] += channelSamples[frame] / decoded.numberOfChannels;
      }
    }
    return Object.freeze({
      samples,
      provenance: Object.freeze({
        source: "file" as const,
        sampleRateHz: decoded.sampleRate,
        channelCount: decoded.numberOfChannels,
        decodedDurationSeconds: decoded.duration,
        analyzedRange: validatedRange,
        calibration: "uncalibrated" as const,
      }),
    });
  } catch (error) {
    if (error instanceof AudioInputError) throw error;
    throw new AudioInputError("decode-failed", "The browser could not decode this audio file.");
  }
}

export function probeAudioDuration(
  file: AudioFile,
  signal?: AbortSignal,
): Promise<number> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    let settled = false;
    const objectUrl = URL.createObjectURL(file as Blob);
    const audio = document.createElement("audio");
    const timeout = setTimeout(() => {
      settle(() => reject(new AudioInputError(
        "decode-failed",
        "The browser could not read this audio file's duration within the local metadata limit.",
      )));
    }, metadataTimeoutMilliseconds);

    const cleanup = (): void => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(objectUrl);
    };
    const settle = (finish: () => void): void => {
      if (settled) return;
      settled = true;
      cleanup();
      finish();
    };
    const onAbort = (): void => {
      settle(() => reject(abortError()));
    };
    const onLoadedMetadata = (): void => {
      const duration = audio.duration;
      settle(() => resolve(duration));
    };
    const onError = (): void => {
      settle(() => reject(new AudioInputError(
        "decode-failed",
        "The browser could not read this audio file's duration.",
      )));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    audio.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    audio.addEventListener("error", onError, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    audio.preload = "metadata";
    audio.src = objectUrl;
    audio.load();
  });
}

function validateDecodedDuration(duration: number): void {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new AudioInputError("decode-failed", "The browser decoded no usable audio samples.");
  }
  if (duration > AUDIO_ANALYSIS_LIMITS.maximumDecodedSeconds) {
    throw new AudioInputError(
      "decoded-audio-too-long",
      `Decoded audio must be at most ${AUDIO_ANALYSIS_LIMITS.maximumDecodedSeconds} seconds long.`,
    );
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function abortError(): DOMException {
  return new DOMException("Audio analysis was cancelled.", "AbortError");
}
