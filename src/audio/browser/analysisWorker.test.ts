import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisWorkerMessage, WorkerFrameMessage } from "../protocol/messages";

class InputPortHarness {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly postMessage = vi.fn();
  readonly start = vi.fn();

  emit(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }
}

type WorkerScopeHarness = {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
};

let scope: WorkerScopeHarness;

beforeEach(async () => {
  vi.resetModules();
  scope = { onmessage: null, postMessage: vi.fn() };
  vi.stubGlobal("self", scope);
  await import("./analysisWorker");
});

afterEach(() => vi.unstubAllGlobals());

function dispatch(data: unknown): void {
  scope.onmessage?.({ data } as MessageEvent);
}

function frame(samples = new Float32Array(2_048)): WorkerFrameMessage {
  return {
    type: "audio-frame",
    frame: {
      sequence: 0,
      startSample: 0,
      sampleRateHz: 48_000,
      samples,
      droppedBefore: 0,
    },
  };
}

function postedMessages(): AnalysisWorkerMessage[] {
  return scope.postMessage.mock.calls.map(([message]) => message as AnalysisWorkerMessage);
}

describe("analysis worker", () => {
  it("returns selection results with the originating request id", () => {
    dispatch({
      type: "analyze-selection",
      requestId: "selection-1",
      samples: new Float32Array(2_048),
      sampleRateHz: 48_000,
      frameSize: 2_048,
    });

    expect(postedMessages()).toMatchObject([{
      type: "selection-result",
      requestId: "selection-1",
      result: { frameSize: 2_048, sampleRateHz: 48_000, frameCount: 1 },
    }]);
    expect(postedMessages()[0]).not.toHaveProperty("result.frames");
  });

  it("returns selection errors with the originating request id", () => {
    dispatch({
      type: "analyze-selection",
      requestId: "selection-2",
      samples: new Float32Array(10),
      sampleRateHz: 48_000,
      frameSize: 2_048,
    });

    expect(postedMessages()).toMatchObject([{
      type: "analysis-error",
      requestId: "selection-2",
      message: expect.stringContaining("at least"),
    }]);
  });

  it("ignores malformed streaming input and returns one result and credit for a valid frame", () => {
    const port = new InputPortHarness();
    dispatch({ type: "attach-input", port, queueCapacity: 3, onsetSensitivity: 1.2 });

    expect(port.start).toHaveBeenCalledOnce();
    expect(port.postMessage).toHaveBeenCalledWith({ type: "credits", count: 3 });

    port.emit({ type: "audio-frame" });
    expect(scope.postMessage).not.toHaveBeenCalled();
    expect(port.postMessage).toHaveBeenCalledTimes(1);

    port.emit(frame());
    expect(postedMessages()).toMatchObject([{
      type: "analysis-result",
      result: { sequence: 0 },
      queue: { accepted: true, queuedFrames: 0 },
    }]);
    expect(port.postMessage).toHaveBeenLastCalledWith({ type: "credits", count: 1 });
    expect(port.postMessage).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["sequence", "0"],
    ["startSample", null],
    ["sampleRateHz", undefined],
    ["droppedBefore", false],
    ["samples", [0, 1]],
  ])("ignores streaming frames with an invalid %s field", (field, value) => {
    const port = new InputPortHarness();
    dispatch({ type: "attach-input", port, queueCapacity: 2 });
    const invalidFrame = frame() as WorkerFrameMessage & { frame: Record<string, unknown> };
    invalidFrame.frame[field] = value;

    port.emit(invalidFrame);

    expect(scope.postMessage).not.toHaveBeenCalled();
    expect(port.postMessage).toHaveBeenCalledTimes(1);
  });

  it("returns protocol-compatible streaming errors and restores one credit for valid frame messages", () => {
    const port = new InputPortHarness();
    dispatch({ type: "attach-input", port, queueCapacity: 2 });

    port.emit(frame(new Float32Array()));

    expect(postedMessages()).toMatchObject([{
      type: "analysis-error",
      message: "audio frame must contain samples",
    }]);
    expect(postedMessages()[0]).not.toHaveProperty("requestId");
    expect(port.postMessage).toHaveBeenLastCalledWith({ type: "credits", count: 1 });
  });

  it("processes and restores credit for every frame while publishing at bounded audio-time cadence and completion", () => {
    const port = new InputPortHarness();
    dispatch({ type: "attach-input", port, queueCapacity: 4 });

    for (let sequence = 0; sequence < 25; sequence += 1) {
      const message = frame();
      port.emit({
        ...message,
        frame: {
          ...message.frame,
          sequence,
          startSample: sequence * 1_024,
        },
      });
    }
    port.emit({ type: "audio-stream-end" });

    expect(postedMessages().filter(({ type }) => type === "analysis-result")).toHaveLength(3);
    expect(postedMessages().at(-1)).toMatchObject({
      type: "analysis-complete",
      result: { sequence: 24 },
      queue: { accepted: true, queuedFrames: 0 },
    });
    expect(port.postMessage.mock.calls.filter(([message]) => (
      (message as { type?: string }).type === "credits"
      && (message as { count?: number }).count === 1
    ))).toHaveLength(25);

    const postsBeforeLateFrame = scope.postMessage.mock.calls.length;
    port.emit({
      ...frame(),
      frame: { ...frame().frame, sequence: 25, startSample: 25 * 1_024 },
    });
    expect(scope.postMessage).toHaveBeenCalledTimes(postsBeforeLateFrame);
    expect(port.postMessage).toHaveBeenLastCalledWith({ type: "credits", count: 1 });
  });
});
