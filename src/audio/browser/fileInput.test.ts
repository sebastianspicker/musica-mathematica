import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioInputError } from "../analysis/contracts";
import { decodeAudioSelection, probeAudioDuration } from "./fileInput";

const file = { type: "audio/wav", size: 1024, arrayBuffer: async () => new ArrayBuffer(8) };
const metadataAt = (duration: number) => ({ metadataProbe: async () => duration });

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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects overlong metadata before reading or decoding the file", async () => {
    const arrayBuffer = vi.fn(file.arrayBuffer);
    const decodeAudioData = vi.fn(decoderFor(90.01).decodeAudioData);
    const rejection = decodeAudioSelection(
      { ...file, arrayBuffer },
      { decodeAudioData },
      { startSeconds: 0, endSeconds: 10 },
      metadataAt(90.01),
    );

    await expect(rejection).rejects.toBeInstanceOf(AudioInputError);
    await expect(rejection).rejects.toMatchObject({ code: "decoded-audio-too-long" });
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(decodeAudioData).not.toHaveBeenCalled();
  });

  it("retains the decoded-duration check after a safe metadata result", async () => {
    const rejection = decodeAudioSelection(
      file,
      decoderFor(90.01),
      { startSeconds: 0, endSeconds: 10 },
      metadataAt(90),
    );

    await expect(rejection).rejects.toMatchObject({ code: "decoded-audio-too-long" });
  });

  it("accepts decoded audio of exactly 90 seconds", async () => {
    const decoded = await decodeAudioSelection(
      file,
      decoderFor(90),
      { startSeconds: 0, endSeconds: 10 },
      metadataAt(90),
    );

    expect(decoded.provenance.source).toBe("file");
    expect(decoded.provenance.decodedDurationSeconds).toBe(90);
    expect(decoded.samples).toHaveLength(1000);
  });

  it("does not read or decode after cancellation during metadata probing", async () => {
    const controller = new AbortController();
    const arrayBuffer = vi.fn(file.arrayBuffer);
    const decodeAudioData = vi.fn(decoderFor(1).decodeAudioData);
    const rejection = decodeAudioSelection(
      { ...file, arrayBuffer },
      { decodeAudioData },
      { startSeconds: 0, endSeconds: 1 },
      {
        signal: controller.signal,
        metadataProbe: async () => {
          controller.abort();
          return 1;
        },
      },
    );

    await expect(rejection).rejects.toBeInstanceOf(AudioInputError);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(decodeAudioData).not.toHaveBeenCalled();
  });
});

describe("probeAudioDuration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads only metadata and releases the object URL", async () => {
    const listeners = new Map<string, () => void>();
    let duration = 90;
    const pause = vi.fn();
    const removeAttribute = vi.fn(() => { duration = Number.NaN; });
    const load = vi.fn(() => { listeners.get("loadedmetadata")?.(); });
    const audio = {
      get duration() { return duration; },
      preload: "",
      src: "",
      addEventListener: (type: string, listener: () => void) => { listeners.set(type, listener); },
      removeEventListener: (type: string) => { listeners.delete(type); },
      pause,
      removeAttribute,
      load,
    } as unknown as HTMLAudioElement;
    const createObjectURL = vi.fn(() => "blob:audio-metadata");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", { createElement: vi.fn(() => audio) });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    await expect(probeAudioDuration(file)).resolves.toBe(90);

    expect(audio.preload).toBe("metadata");
    expect(audio.src).toBe("blob:audio-metadata");
    expect(pause).toHaveBeenCalledOnce();
    expect(removeAttribute).toHaveBeenCalledWith("src");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:audio-metadata");
  });

  it("releases the media element and object URL when cancelled", async () => {
    const listeners = new Map<string, () => void>();
    const pause = vi.fn();
    const removeAttribute = vi.fn();
    const audio = {
      duration: Number.NaN,
      preload: "",
      src: "",
      addEventListener: (type: string, listener: () => void) => { listeners.set(type, listener); },
      removeEventListener: (type: string) => { listeners.delete(type); },
      pause,
      removeAttribute,
      load: vi.fn(),
    } as unknown as HTMLAudioElement;
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", { createElement: vi.fn(() => audio) });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:audio-metadata"), revokeObjectURL });
    const controller = new AbortController();

    const probing = probeAudioDuration(file, controller.signal);
    controller.abort();

    await expect(probing).rejects.toMatchObject({ name: "AbortError" });
    expect(pause).toHaveBeenCalledOnce();
    expect(removeAttribute).toHaveBeenCalledWith("src");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:audio-metadata");
    expect(listeners).toEqual(new Map());
  });
});
