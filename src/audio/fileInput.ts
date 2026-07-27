import {
  AUDIO_ANALYSIS_LIMITS,
  AudioInputError,
  type AnalysisRange,
  type AudioProvenance,
  validateAnalysisRange,
} from "./contracts";

export type DecodedSelection = Readonly<{
  samples: Float32Array;
  provenance: AudioProvenance;
}>;

type AudioDecoder = Readonly<{
  decodeAudioData(audioData: ArrayBuffer): Promise<AudioBuffer>;
}>;

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
  file: Pick<File, "type" | "size" | "arrayBuffer">,
  decoder: AudioDecoder,
  range: AnalysisRange,
): Promise<DecodedSelection> {
  validateAudioFile(file);
  try {
    const encoded = await file.arrayBuffer();
    const decoded = await decoder.decodeAudioData(encoded);
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) {
      throw new AudioInputError("decode-failed", "The browser decoded no usable audio samples.");
    }
    if (decoded.duration > AUDIO_ANALYSIS_LIMITS.maximumDecodedSeconds) {
      throw new AudioInputError(
        "decoded-audio-too-long",
        `Decoded audio must be at most ${AUDIO_ANALYSIS_LIMITS.maximumDecodedSeconds} seconds long.`,
      );
    }
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
