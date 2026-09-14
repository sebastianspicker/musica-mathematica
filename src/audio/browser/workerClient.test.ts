import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisWorkerMessage } from "../protocol/messages";
import { prepareMicrophoneAnalysisPipeline } from "./workerClient";

class WorkerHarness {
  onmessage: ((event: MessageEvent<AnalysisWorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();

  emit(message: AnalysisWorkerMessage): void {
    this.onmessage?.({ data: message } as MessageEvent<AnalysisWorkerMessage>);
  }

  fail(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

class PortHarness {
  readonly postMessage = vi.fn();
}

class NodeHarness {
  static instances: NodeHarness[] = [];
  readonly port = new PortHarness();
  readonly connect = vi.fn((next: unknown) => next);
  readonly disconnect = vi.fn();

  constructor() {
    NodeHarness.instances.push(this);
  }
}

function contextWith(moduleReady: Promise<void> = Promise.resolve()): AudioContext {
  const source = new NodeHarness();
  const gain = new NodeHarness() as NodeHarness & { gain: { value: number } };
  gain.gain = { value: 1 };
  return {
    audioWorklet: { addModule: vi.fn(() => moduleReady) },
    createMediaStreamSource: vi.fn(() => source),
    createGain: vi.fn(() => gain),
    destination: {},
  } as unknown as AudioContext;
}

function streamWithStop(): { stream: MediaStream; stop: ReturnType<typeof vi.fn> } {
  const stop = vi.fn();
  return {
    stream: { getTracks: () => [{ stop }] } as unknown as MediaStream,
    stop,
  };
}

function options(worker: WorkerHarness, overrides: Record<string, unknown> = {}) {
  return {
    workletModuleUrl: "/capture.js",
    workerFactory: () => worker as unknown as Worker,
    onResult: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  NodeHarness.instances = [];
  vi.stubGlobal("AudioWorkletNode", NodeHarness);
  vi.stubGlobal("MessageChannel", class {
    readonly port1 = new PortHarness();
    readonly port2 = new PortHarness();
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("microphone analysis pipeline lifecycle", () => {
  it("reports a worker failure before permission and stops a late stream without waiting for worklet setup", async () => {
    const context = contextWith(new Promise<void>(() => undefined));
    const worker = new WorkerHarness();
    const onError = vi.fn();
    const prepared = prepareMicrophoneAnalysisPipeline(context, options(worker, { onError }));
    worker.fail("module could not load");
    expect(onError).toHaveBeenCalledWith("module could not load");
    expect(worker.terminate).toHaveBeenCalledOnce();
    const { stream, stop } = streamWithStop();
    await expect(prepared.connect(stream)).rejects.toThrow("module could not load");
    expect(stop).toHaveBeenCalledOnce();
    expect(context.createMediaStreamSource).not.toHaveBeenCalled();
    prepared.stop();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("cancels delayed setup and stops a late stream without attaching it", async () => {
    let releaseModule: () => void = () => undefined;
    const moduleReady = new Promise<void>((resolve) => {
      releaseModule = resolve;
    });
    const context = contextWith(moduleReady);
    const worker = new WorkerHarness();
    const prepared = prepareMicrophoneAnalysisPipeline(context, options(worker));
    const { stream, stop } = streamWithStop();

    const connection = prepared.connect(stream);
    prepared.stop();
    releaseModule();

    await expect(connection).rejects.toMatchObject({ name: "AbortError" });
    expect(stop).toHaveBeenCalledOnce();
    expect(context.createMediaStreamSource).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("posts stop after attachment, stops tracks immediately, and resolves the worker's final response", async () => {
    const context = contextWith();
    const worker = new WorkerHarness();
    const onResult = vi.fn();
    const prepared = prepareMicrophoneAnalysisPipeline(context, options(worker, { onResult }));
    const { stream, stop } = streamWithStop();
    const pipeline = await prepared.connect(stream);
    const captureNode = NodeHarness.instances.at(-1);
    expect(captureNode).toBeDefined();

    const completion = pipeline.finish();

    expect(captureNode?.port.postMessage.mock.calls.map(([message]) => (
      (message as { type: string }).type
    ))).toEqual(["attach-output", "stop-capture"]);
    expect(stop).toHaveBeenCalledOnce();

    worker.emit({
      type: "analysis-complete",
      result: null,
      temporal: { onsetTimesSeconds: [], tempoHypotheses: [], meterHypotheses: [] },
      queue: { accepted: true, staleFrames: 0, overflowFrames: 0, sequenceGaps: 0, queuedFrames: 0 },
    });

    await expect(completion).resolves.toMatchObject({ result: null });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(onResult).not.toHaveBeenCalled();
  });

  it("aborts and reports a final-response timeout after the one bounded wait", async () => {
    vi.useFakeTimers();
    const context = contextWith();
    const worker = new WorkerHarness();
    const onError = vi.fn();
    const prepared = prepareMicrophoneAnalysisPipeline(context, options(worker, {
      completionTimeoutMilliseconds: 20,
      onError,
    }));
    const { stream } = streamWithStop();
    const pipeline = await prepared.connect(stream);

    const completion = pipeline.finish();
    const rejection = expect(completion).rejects.toThrow("within 1 second");
    await vi.advanceTimersByTimeAsync(20);

    await rejection;
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("within 1 second"));
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("tears down the stream immediately when the worker itself fails", async () => {
    const context = contextWith();
    const worker = new WorkerHarness();
    const onError = vi.fn();
    const prepared = prepareMicrophoneAnalysisPipeline(context, options(worker, { onError }));
    const { stream, stop } = streamWithStop();
    await prepared.connect(stream);

    worker.fail("worker crashed");

    expect(stop).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith("worker crashed");
  });
});
