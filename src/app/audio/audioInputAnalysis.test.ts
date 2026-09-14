import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisRequestGate } from "./audioInputAnalysis";

const workerClient = vi.hoisted(() => ({
  analyzeSelectionInWorker: vi.fn(),
  prepareMicrophoneAnalysisPipeline: vi.fn(),
}));

vi.mock("../../audio/browser/workerClient", () => workerClient);
vi.mock("../../audio/browser/runtime", () => ({
  captureProcessorModuleUrl: "/capture.js",
  createSelectionAnalysisWorker: vi.fn(),
  createStreamingAnalysisWorker: vi.fn(),
}));

import { startMicrophoneAnalysis } from "./audioInputAnalysis";

class AudioContextHarness {
  static instances: AudioContextHarness[] = [];
  readonly state = "running";
  readonly close = vi.fn(() => Promise.resolve());
  readonly resume = vi.fn(() => Promise.resolve());

  constructor() {
    AudioContextHarness.instances.push(this);
  }
}

function gateHarness(): { gate: AnalysisRequestGate; cancel(): void } {
  let current = true;
  let cleanup: (() => void) | null = null;
  return {
    gate: {
      isCurrent: () => current,
      registerCleanup: (nextCleanup) => {
        cleanup = nextCleanup;
      },
      clearCleanup: (finishedCleanup) => {
        if (cleanup === finishedCleanup) cleanup = null;
      },
    },
    cancel() {
      current = false;
      cleanup?.();
      cleanup = null;
    },
  };
}

function microphoneStream() {
  const stop = vi.fn();
  const track = {
    stop,
    getSettings: () => ({ sampleRate: 48_000 }),
  } as unknown as MediaStreamTrack;
  const stream = {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, stop };
}

function stateHarness() {
  return {
    onAnalysis: vi.fn(),
    setBusy: vi.fn(),
    setStatus: vi.fn(),
  };
}

function startRequest(gate: AnalysisRequestGate, state = stateHarness()) {
  return {
    request: {
      analysisSettings: {},
      durationSeconds: 5,
      frameSize: 2_048 as const,
      gate,
      state,
      setSettings: vi.fn(),
    },
    state,
  };
}

beforeEach(() => {
  AudioContextHarness.instances = [];
  vi.clearAllMocks();
  vi.stubGlobal("window", { AudioContext: AudioContextHarness });
  vi.stubGlobal("isSecureContext", true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("microphone analysis orchestration", () => {
  it("cleans up at the acquisition deadline even when context resume has not resolved", async () => {
    vi.useFakeTimers();
    let resumeContext: () => void = () => undefined;
    const resume = vi.fn(() => new Promise<void>((resolve) => { resumeContext = resolve; }));
    const close = vi.fn(() => Promise.resolve());
    vi.stubGlobal("window", { AudioContext: class {
      readonly state = "suspended";
      readonly resume = resume;
      readonly close = close;
    } });
    const { stream, stop } = microphoneStream();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => Promise.resolve(stream) } });
    const preparation = { connect: vi.fn(), stop: vi.fn() };
    workerClient.prepareMicrophoneAnalysisPipeline.mockReturnValue(preparation);
    const { request, state } = startRequest(gateHarness().gate);
    const started = startMicrophoneAnalysis(request);
    await vi.advanceTimersByTimeAsync(0);
    expect(resume).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5_000);
    await started;
    expect(stop).toHaveBeenCalledOnce();
    expect(preparation.stop).toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(state.setBusy).toHaveBeenLastCalledWith(false);
    expect(preparation.connect).not.toHaveBeenCalled();
    resumeContext();
    await Promise.resolve();
    expect(preparation.connect).not.toHaveBeenCalled();
  });

  it("aborts resources on a preparation error and never connects subsequently granted tracks", async () => {
    let grantPermission: (stream: MediaStream) => void = () => undefined;
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise<MediaStream>((resolve) => { grantPermission = resolve; }) } });
    const preparation = { connect: vi.fn(), stop: vi.fn() };
    workerClient.prepareMicrophoneAnalysisPipeline.mockReturnValue(preparation);
    const { request, state } = startRequest(gateHarness().gate);
    const started = startMicrophoneAnalysis(request);
    const options = workerClient.prepareMicrophoneAnalysisPipeline.mock.calls[0][1];
    options.onError("worker failed before permission");
    expect(preparation.stop).toHaveBeenCalledOnce();
    expect(state.setBusy).toHaveBeenLastCalledWith(false);
    const { stream, stop } = microphoneStream();
    grantPermission(stream);
    await started;
    expect(stop).toHaveBeenCalledOnce();
    expect(preparation.connect).not.toHaveBeenCalled();
    expect(request.setSettings).not.toHaveBeenCalled();
    expect(AudioContextHarness.instances[0].close).toHaveBeenCalledOnce();
  });

  it("prepares local resources before permission and stops a late granted stream after cancellation", async () => {
    let grantPermission: (stream: MediaStream) => void = () => undefined;
    const permission = new Promise<MediaStream>((resolve) => {
      grantPermission = resolve;
    });
    const getUserMedia = vi.fn(() => permission);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const preparation = { connect: vi.fn(), stop: vi.fn() };
    workerClient.prepareMicrophoneAnalysisPipeline.mockReturnValue(preparation);
    const requestGate = gateHarness();
    const { request } = startRequest(requestGate.gate);

    const started = startMicrophoneAnalysis(request);
    await Promise.resolve();
    expect(workerClient.prepareMicrophoneAnalysisPipeline.mock.invocationCallOrder[0]).toBeLessThan(
      getUserMedia.mock.invocationCallOrder[0],
    );

    requestGate.cancel();
    const { stream, stop } = microphoneStream();
    grantPermission(stream);
    await started;

    expect(stop).toHaveBeenCalledOnce();
    expect(preparation.stop).toHaveBeenCalledOnce();
    expect(preparation.connect).not.toHaveBeenCalled();
    expect(AudioContextHarness.instances[0].close).toHaveBeenCalledOnce();
  });

  it("uses the acquisition deadline to stop tracks, request ordered completion, and then leave busy state", async () => {
    vi.useFakeTimers();
    const { stream, stop } = microphoneStream();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(() => Promise.resolve(stream)) } });
    const pipeline = {
      finish: vi.fn(() => Promise.resolve({
        result: null,
        temporal: { onsetTimesSeconds: [], tempoHypotheses: [], meterHypotheses: [] },
        queue: { accepted: true, staleFrames: 0, overflowFrames: 0, sequenceGaps: 0, queuedFrames: 0 },
      })),
      stop: vi.fn(),
    };
    const preparation = { connect: vi.fn(() => Promise.resolve(pipeline)), stop: vi.fn() };
    workerClient.prepareMicrophoneAnalysisPipeline.mockReturnValue(preparation);
    const requestGate = gateHarness();
    const { request, state } = startRequest(requestGate.gate);

    await startMicrophoneAnalysis(request);
    expect(stop).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(stop).toHaveBeenCalledOnce();
    expect(pipeline.finish).toHaveBeenCalledOnce();
    expect(state.setBusy).toHaveBeenLastCalledWith(false);
    expect(state.setStatus).toHaveBeenLastCalledWith(expect.stringContaining("segment complete"));
  });

  it("tears down prepared resources and acquired tracks when pipeline connection fails", async () => {
    const { stream, stop } = microphoneStream();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(() => Promise.resolve(stream)) } });
    const preparation = {
      connect: vi.fn(() => Promise.reject(new Error("setup failed"))),
      stop: vi.fn(),
    };
    workerClient.prepareMicrophoneAnalysisPipeline.mockReturnValue(preparation);
    const requestGate = gateHarness();
    const { request, state } = startRequest(requestGate.gate);

    await startMicrophoneAnalysis(request);

    expect(stop).toHaveBeenCalledOnce();
    expect(preparation.stop).toHaveBeenCalledOnce();
    expect(AudioContextHarness.instances[0].close).toHaveBeenCalledOnce();
    expect(state.setBusy).toHaveBeenLastCalledWith(false);
    expect(state.setStatus).toHaveBeenLastCalledWith("setup failed");
  });
});
