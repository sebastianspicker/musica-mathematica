import { describe, expect, it } from "vitest";
import { AudioInputError } from "../analysis/contracts";
import { decodeAudioSelection } from "./fileInput";

const file = { type: "audio/wav", size: 1024, arrayBuffer: async () => new ArrayBuffer(8) };

function decoderFor(duration: number, sampleRate = 100) {
  const length = Math.round(duration * sampleRate);
  return {
    decodeAudioData: async () => ({
      duration,
      sampleRate,
      length,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(length),
    }) as unknown as AudioBuffer,
  };
}

describe("decodeAudioSelection", () => {
  it("rejects decoded audio longer than 90 seconds", async () => {
    const rejection = decodeAudioSelection(file, decoderFor(90.01), { startSeconds: 0, endSeconds: 10 });

    await expect(rejection).rejects.toBeInstanceOf(AudioInputError);
    await expect(rejection).rejects.toMatchObject({ code: "decoded-audio-too-long" });
  });

  it("accepts decoded audio of exactly 90 seconds", async () => {
    const decoded = await decodeAudioSelection(file, decoderFor(90), { startSeconds: 0, endSeconds: 10 });

    expect(decoded.provenance.source).toBe("file");
    expect(decoded.provenance.decodedDurationSeconds).toBe(90);
    expect(decoded.samples).toHaveLength(1000);
  });
});
