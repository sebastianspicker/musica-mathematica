import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class PortHarness {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly postMessage = vi.fn();
  readonly start = vi.fn();

  emit(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }
}

type ProcessorHarness = Readonly<{
  port: PortHarness;
  process(inputs: Float32Array[][]): boolean;
}>;

let Processor: new (options: AudioWorkletNodeOptions) => ProcessorHarness;

beforeEach(async () => {
  vi.resetModules();
  class BaseProcessor {
    readonly port = new PortHarness();
  }
  vi.stubGlobal("AudioWorkletProcessor", BaseProcessor);
  vi.stubGlobal("sampleRate", 48_000);
  vi.stubGlobal("registerProcessor", vi.fn((_: string, constructor: typeof Processor) => {
    Processor = constructor;
  }));
  await import("./captureProcessor");
});

afterEach(() => vi.unstubAllGlobals());

describe("capture worklet completion ordering", () => {
  it("stops accepting immediately and posts EOS after already-posted frames on the same port", () => {
    const processor = new Processor({ processorOptions: { frameSize: 2_048 } } as AudioWorkletNodeOptions);
    const output = new PortHarness();
    processor.port.emit({ type: "attach-output", port: output as unknown as MessagePort });
    output.emit({ type: "credits", count: 1 });

    processor.process([[Float32Array.from({ length: 2_048 }, () => 0.25)]]);
    processor.port.emit({ type: "stop-capture" });
    processor.process([[new Float32Array(2_048)]]);

    expect(output.postMessage.mock.calls.map(([message]) => (message as { type: string }).type)).toEqual([
      "audio-frame",
      "audio-stream-end",
    ]);
    expect(output.postMessage.mock.calls[0][0]).toMatchObject({
      type: "audio-frame",
      frame: { sequence: 0, startSample: 0 },
    });
  });
});
