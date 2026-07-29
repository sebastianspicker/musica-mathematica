import { describe, expect, it, vi } from "vitest";
import {
  AUDIO_ANALYSIS_LIMITS,
  AudioInputError,
  BoundedAudioFrameQueue,
  validateAnalysisRange,
  validateMicrophoneDuration,
  type AudioFrame,
} from "./contracts";
import { sanitizeMediaTrackSettings, startMicrophoneSession } from "./capture";
import { decodeAudioSelection, validateAudioFile } from "./fileInput";

function frame(sequence: number, droppedBefore = 0): AudioFrame {
  return {
    sequence,
    startSample: sequence * 4,
    sampleRateHz: 48_000,
    samples: new Float32Array(4),
    droppedBefore,
  };
}

describe("bounded audio contracts", () => {
  it("keeps the newest bounded frames and reports gaps without double counting", () => {
    const queue = new BoundedAudioFrameQueue(2);
    queue.push(frame(0));
    queue.push(frame(3, 2));
    queue.push(frame(4));

    expect(queue.getStatus()).toEqual({
      accepted: true,
      staleFrames: 0,
      overflowFrames: 1,
      sequenceGaps: 2,
      queuedFrames: 2,
    });
    expect(queue.push(frame(4)).accepted).toBe(false);
    expect(queue.getStatus().staleFrames).toBe(1);
    expect(queue.drain().map(({ sequence }) => sequence)).toEqual([3, 4]);
  });

  it("enforces microphone, selection, and file bounds", () => {
    expect(() => { validateMicrophoneDuration(5); }).not.toThrow();
    expect(() => { validateMicrophoneDuration(20); }).not.toThrow();
    expect(() => { validateMicrophoneDuration(4.99); }).toThrowError(AudioInputError);
    expect(validateAnalysisRange({ startSeconds: 2, endSeconds: 32 }, 40)).toEqual({
      startSeconds: 2,
      endSeconds: 32,
    });
    expect(() => { validateAnalysisRange({ startSeconds: 0, endSeconds: 30.01 }, 40); }).toThrowError(AudioInputError);
    expect(() => { validateAudioFile({ type: "text/plain", size: 100 }); }).toThrowError(AudioInputError);
    expect(() => { validateAudioFile({ type: "audio/wav", size: AUDIO_ANALYSIS_LIMITS.maximumFileBytes + 1 }); }).toThrowError(AudioInputError);
  });

  it("retains only allow-listed media settings", () => {
    const sanitized = sanitizeMediaTrackSettings({
      sampleRate: 48_000,
      channelCount: 1,
      echoCancellation: false,
      deviceId: "must-not-survive",
      groupId: "must-not-survive",
      latency: 0.01,
    } as MediaTrackSettings & { latency: number });

    expect(sanitized).toEqual({
      sampleRate: 48_000,
      channelCount: 1,
      echoCancellation: false,
      latency: 0.01,
    });
    expect(JSON.stringify(sanitized)).not.toMatch(/device|group|label/i);
  });

  it("requires a user gesture and stops every microphone track", async () => {
    await expect(startMicrophoneSession({
      userInitiated: false,
      durationSeconds: 5,
      secureContext: true,
    })).rejects.toMatchObject({ code: "user-gesture-required" });

    const stop = vi.fn();
    const audioTrack = {
      stop,
      getSettings: () => ({ sampleRate: 48_000, deviceId: "private" }),
    } as unknown as MediaStreamTrack;
    const secondStop = vi.fn();
    const secondTrack = { stop: secondStop } as unknown as MediaStreamTrack;
    const stream = {
      getAudioTracks: () => [audioTrack],
      getTracks: () => [audioTrack, secondTrack],
    } as unknown as MediaStream;
    let scheduledStop: (() => void) | undefined;
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    const session = await startMicrophoneSession({
      userInitiated: true,
      durationSeconds: 5,
      secureContext: true,
      mediaDevices: { getUserMedia },
      scheduleStop: (callback) => {
        scheduledStop = callback;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      cancelScheduledStop: vi.fn(),
    });

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { autoGainControl: false, echoCancellation: false, noiseSuppression: false },
      video: false,
    });
    expect(session.settings).toEqual({ sampleRate: 48_000 });
    scheduledStop?.();
    expect(stop).toHaveBeenCalledOnce();
    expect(secondStop).toHaveBeenCalledOnce();
  });

  it("decodes only the selected mono mix and records no file identity", async () => {
    const left = Float32Array.from([1, 0.5, 0, -0.5]);
    const right = Float32Array.from([-1, 0.5, 1, 0.5]);
    const decoded = {
      duration: 1,
      sampleRate: 4,
      length: 4,
      numberOfChannels: 2,
      getChannelData: (channel: number) => channel === 0 ? left : right,
    } as AudioBuffer;
    const result = await decodeAudioSelection(
      { type: "audio/wav", size: 8, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) },
      { decodeAudioData: () => Promise.resolve(decoded) },
      { startSeconds: 0, endSeconds: 1 },
    );

    expect(Array.from(result.samples)).toEqual([0, 0.5, 0.5, 0]);
    expect(result.provenance).toEqual({
      source: "file",
      sampleRateHz: 4,
      channelCount: 2,
      decodedDurationSeconds: 1,
      analyzedRange: { startSeconds: 0, endSeconds: 1 },
      calibration: "uncalibrated",
    });
    expect(JSON.stringify(result.provenance)).not.toMatch(/name|path|samples|device/i);
  });
});
