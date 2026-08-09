import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioSelectionAnalysis } from "../../audio/analysis";
import type { DecodedSelection } from "../../audio/fileInput";
import type { SelectionAnalysisWorkerOptions } from "../../audio/workerClient";
import type { AnalysisRequestGate } from "./audioInputAnalysis";

const mocks = vi.hoisted(() => ({
  analyzeSelectionInWorker: vi.fn(),
  createMicrophoneAnalysisPipeline: vi.fn(),
  decodeAudioSelection: vi.fn(),
  startMicrophoneSession: vi.fn(),
}));

vi.mock("../../audio/capture", () => ({
  startMicrophoneSession: mocks.startMicrophoneSession,
}));

vi.mock("../../audio/fileInput", () => ({
  decodeAudioSelection: mocks.decodeAudioSelection,
}));

vi.mock("../../audio/workerClient", () => ({
  analyzeSelectionInWorker: mocks.analyzeSelectionInWorker,
  createMicrophoneAnalysisPipeline: mocks.createMicrophoneAnalysisPipeline,
}));

import { analyzeFileSelection, startMicrophoneAnalysis } from "./audioInputAnalysis";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("guarded local audio analysis", () => {
  it("discards a file result when the request becomes stale during decoding", async () => {
    const decoded = deferred<DecodedSelection>();
    mocks.decodeAudioSelection.mockReturnValue(decoded.promise);
    const browserAudio = installAudioContext();
    const request = controllableGate();
    const onAnalysis = vi.fn();
    const setBusy = vi.fn();
    const setStatus = vi.fn();
    const fileRef = { current: {} as File };

    const pending = analyzeFileSelection({
      analysisSettings: {},
      fileRef,
      frameSize: 2_048,
      gate: request.gate,
      selectionDuration: 1,
      selectionStart: 0,
      state: { onAnalysis, setBusy, setStatus },
    });

    request.cancel();
    decoded.resolve(decodedSelection());
    await pending;

    expect(onAnalysis).toHaveBeenCalledOnce();
    expect(onAnalysis).toHaveBeenCalledWith(null);
    expect(mocks.analyzeSelectionInWorker).not.toHaveBeenCalled();
    expect(fileRef.current).not.toBeNull();
    expect(setBusy).toHaveBeenCalledTimes(1);
    expect(browserAudio.close).toHaveBeenCalledOnce();
    expect(setStatus).not.toHaveBeenCalledWith(expect.stringContaining("complete"));
  });

  it("publishes a successful file analysis, clears the selected file, and closes its context once", async () => {
    mocks.decodeAudioSelection.mockResolvedValue(decodedSelection());
    mocks.analyzeSelectionInWorker.mockResolvedValue(selectionAnalysis());
    const browserAudio = installAudioContext();
    const request = controllableGate();
    const onAnalysis = vi.fn();
    const setBusy = vi.fn();
    const setStatus = vi.fn();
    const fileRef = { current: {} as File };

    await analyzeFileSelection({
      analysisSettings: {},
      fileRef,
      frameSize: 2_048,
      gate: request.gate,
      selectionDuration: 1,
      selectionStart: 0,
      state: { onAnalysis, setBusy, setStatus },
    });

    expect(onAnalysis).toHaveBeenNthCalledWith(1, null);
    expect(onAnalysis).toHaveBeenNthCalledWith(2, expect.objectContaining({ headline: "Local audio observation" }));
    expect(fileRef.current).toBeNull();
    expect(setBusy.mock.calls).toEqual([[true], [false]]);
    expect(setStatus).toHaveBeenLastCalledWith("Local analysis complete: 1.00 s, 0 frames. Raw audio was discarded.");
    expect(browserAudio.close).toHaveBeenCalledOnce();
  });

  it("retains the selected file and reports a worker error", async () => {
    mocks.decodeAudioSelection.mockResolvedValue(decodedSelection());
    mocks.analyzeSelectionInWorker.mockRejectedValue(new Error("Audio analysis worker failed."));
    const browserAudio = installAudioContext();
    const onAnalysis = vi.fn();
    const setBusy = vi.fn();
    const setStatus = vi.fn();
    const fileRef = { current: {} as File };

    await analyzeFileSelection({
      analysisSettings: {},
      fileRef,
      frameSize: 2_048,
      gate: controllableGate().gate,
      selectionDuration: 1,
      selectionStart: 0,
      state: { onAnalysis, setBusy, setStatus },
    });

    expect(onAnalysis).toHaveBeenCalledExactlyOnceWith(null);
    expect(fileRef.current).not.toBeNull();
    expect(setBusy.mock.calls).toEqual([[true], [false]]);
    expect(setStatus).toHaveBeenLastCalledWith("Audio analysis worker failed.");
    expect(browserAudio.close).toHaveBeenCalledOnce();
  });

  it("does not start file analysis when Web Audio is unsupported", async () => {
    vi.stubGlobal("window", { clearTimeout, setTimeout });
    const onAnalysis = vi.fn();
    const setBusy = vi.fn();
    const setStatus = vi.fn();
    const fileRef = { current: {} as File };

    await analyzeFileSelection({
      analysisSettings: {},
      fileRef,
      frameSize: 2_048,
      gate: controllableGate().gate,
      selectionDuration: 1,
      selectionStart: 0,
      state: { onAnalysis, setBusy, setStatus },
    });

    expect(mocks.decodeAudioSelection).not.toHaveBeenCalled();
    expect(onAnalysis).not.toHaveBeenCalled();
    expect(setBusy).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledExactlyOnceWith("File analysis is unavailable because Web Audio is not supported.");
  });

  it("discards a file result and aborts its worker when the request becomes stale", async () => {
    const analysis = deferred<AudioSelectionAnalysis>();
    let workerOptions: SelectionAnalysisWorkerOptions | undefined;
    mocks.decodeAudioSelection.mockResolvedValue(decodedSelection());
    mocks.analyzeSelectionInWorker.mockImplementation((_samples, _sampleRateHz, options) => {
      workerOptions = options;
      return analysis.promise;
    });
    const browserAudio = installAudioContext();
    const request = controllableGate();
    const onAnalysis = vi.fn();
    const setBusy = vi.fn();
    const setStatus = vi.fn();
    const fileRef = { current: {} as File };

    const pending = analyzeFileSelection({
      analysisSettings: {},
      fileRef,
      frameSize: 2_048,
      gate: request.gate,
      selectionDuration: 1,
      selectionStart: 0,
      state: { onAnalysis, setBusy, setStatus },
    });
    await vi.waitFor(() => expect(mocks.analyzeSelectionInWorker).toHaveBeenCalledOnce());

    request.cancel();
    analysis.resolve(selectionAnalysis());
    await pending;

    expect(workerOptions?.signal?.aborted).toBe(true);
    expect(onAnalysis).toHaveBeenCalledExactlyOnceWith(null);
    expect(fileRef.current).not.toBeNull();
    expect(setBusy).toHaveBeenCalledExactlyOnceWith(true);
    expect(browserAudio.close).toHaveBeenCalledOnce();
  });

  it("stops a microphone session that resolves after cancellation", async () => {
    const session = deferred<Readonly<{
      stream: MediaStream;
      settings: Readonly<{ sampleRate: number }>;
      stop: () => void;
    }>>();
    mocks.startMicrophoneSession.mockReturnValue(session.promise);
    const browserAudio = installAudioContext();
    const request = controllableGate();
    const onAnalysis = vi.fn();
    const setBusy = vi.fn();
    const setSettings = vi.fn();
    const setStatus = vi.fn();
    const stop = vi.fn();

    const pending = startMicrophoneAnalysis({
      analysisSettings: {},
      durationSeconds: 5,
      frameSize: 2_048,
      gate: request.gate,
      setSettings,
      state: { onAnalysis, setBusy, setStatus },
    });

    request.cancel();
    session.resolve({ stream: {} as MediaStream, settings: { sampleRate: 48_000 }, stop });
    await pending;

    expect(stop).toHaveBeenCalledOnce();
    expect(browserAudio.close).toHaveBeenCalledOnce();
    expect(setSettings).not.toHaveBeenCalled();
    expect(mocks.createMicrophoneAnalysisPipeline).not.toHaveBeenCalled();
    expect(onAnalysis).toHaveBeenCalledOnce();
    expect(onAnalysis).toHaveBeenCalledWith(null);
    expect(setBusy).toHaveBeenCalledTimes(1);
  });
});

function controllableGate(): Readonly<{ gate: AnalysisRequestGate; cancel: () => void }> {
  let current = true;
  let cleanup: (() => void) | null = null;
  const gate: AnalysisRequestGate = {
    isCurrent: () => current,
    registerCleanup: (nextCleanup) => {
      if (current) cleanup = nextCleanup;
      else nextCleanup();
    },
    clearCleanup: (finishedCleanup) => {
      if (cleanup === finishedCleanup) cleanup = null;
    },
  };
  return {
    gate,
    cancel: () => {
      current = false;
      const pendingCleanup = cleanup;
      cleanup = null;
      pendingCleanup?.();
    },
  };
}

function installAudioContext(): Readonly<{ close: ReturnType<typeof vi.fn> }> {
  const close = vi.fn().mockResolvedValue(undefined);
  class TestAudioContext {
    readonly state = "running";
    close = close;
    resume = vi.fn().mockResolvedValue(undefined);
  }
  vi.stubGlobal("window", {
    AudioContext: TestAudioContext,
    clearTimeout,
    setTimeout,
  });
  return { close };
}

function deferred<T>(): Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
}> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function decodedSelection(): DecodedSelection {
  return {
    samples: new Float32Array(2_048),
    provenance: {
      source: "file",
      sampleRateHz: 48_000,
      channelCount: 1,
      decodedDurationSeconds: 1,
      analyzedRange: { startSeconds: 0, endSeconds: 1 },
      calibration: "uncalibrated",
    },
  };
}

function selectionAnalysis(): AudioSelectionAnalysis {
  return {
    calibration: "uncalibrated",
    sampleRateHz: 48_000,
    frameSize: 2_048,
    hopSize: 1_024,
    durationSeconds: 1,
    waveform: [],
    estimatedNoiseFloorDbfs: -72,
    frames: [],
    spectralFlux: [],
    onsetTimesSeconds: [],
    tempoHypotheses: [],
    meterHypotheses: [],
    chordHypotheses: [],
  };
}
