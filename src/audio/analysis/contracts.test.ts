import { describe, expect, it } from "vitest";
import { AUDIO_ANALYSIS_LIMITS, AudioInputError, validateMicrophoneDuration } from "./contracts";

describe("audio analysis limits", () => {
  it("pins the literal public limits", () => {
    expect(AUDIO_ANALYSIS_LIMITS.minimumMicrophoneSeconds).toBe(5);
    expect(AUDIO_ANALYSIS_LIMITS.maximumMicrophoneSeconds).toBe(20);
    expect(AUDIO_ANALYSIS_LIMITS.maximumFileBytes).toBe(26_214_400);
    expect(AUDIO_ANALYSIS_LIMITS.maximumDecodedSeconds).toBe(90);
    expect(AUDIO_ANALYSIS_LIMITS.maximumSelectionSeconds).toBe(30);
    expect([...AUDIO_ANALYSIS_LIMITS.supportedFrameSizes]).toEqual([2048, 4096]);
    expect(AUDIO_ANALYSIS_LIMITS.overlapRatio).toBe(0.5);
    expect(AUDIO_ANALYSIS_LIMITS.defaultQueueCapacity).toBe(4);
  });

  it("accepts the microphone duration bounds and rejects values outside them", () => {
    expect(() => validateMicrophoneDuration(5)).not.toThrow();
    expect(() => validateMicrophoneDuration(20)).not.toThrow();
    expect(() => validateMicrophoneDuration(20.01)).toThrow(AudioInputError);
    expect(() => validateMicrophoneDuration(4.99)).toThrow(AudioInputError);
  });
});
