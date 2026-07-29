import { afterEach, describe, expect, it, vi } from "vitest";
import type { AudioSelectionAnalysis } from "./analysis";
import { analyzeSelectionInWorker } from "./workerClient";
import type { WorkerSelectionMessage } from "./workerProtocol";

afterEach(() => vi.unstubAllGlobals());

function selectionAnalysis(): AudioSelectionAnalysis {
  return {
    calibration: "uncalibrated",
    sampleRateHz: 48_000,
    frameSize: 2_048,
    hopSize: 1_024,
    durationSeconds: 2_048 / 48_000,
    waveform: [],
    estimatedNoiseFloorDbfs: -60,
    frames: [],
    spectralFlux: [],
    onsetTimesSeconds: [],
    tempoHypotheses: [],
    meterHypotheses: [],
    chordHypotheses: [],
  };
}

describe("selection analysis worker client", () => {
  it("rejects non-owning views before creating a worker", async () => {
    const construct = vi.fn();
    vi.stubGlobal("Worker", function WorkerStub() { construct(); });
    const backing = new Float32Array(4_096);
    await expect(analyzeSelectionInWorker(
      backing.subarray(0, 2_048),
      48_000,
      { workerModuleUrl: "worker.js" },
    )).rejects.toThrow("complete transferable ArrayBuffer");
    expect(construct).not.toHaveBeenCalled();
  });

  it("posts one bounded local job and terminates after the derived result", async () => {
    const derived = selectionAnalysis();
    const terminate = vi.fn();
    const posted: Array<{ message: WorkerSelectionMessage; transfer: Transferable[] }> = [];
    vi.stubGlobal("Worker", class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;

      postMessage(message: WorkerSelectionMessage, transfer: Transferable[]) {
        posted.push({ message, transfer });
        queueMicrotask(() => this.onmessage?.({
          data: { type: "selection-result", requestId: message.requestId, result: derived },
        } as MessageEvent));
      }

      terminate() {
        terminate();
      }
    });

    const samples = new Float32Array(2_048);
    await expect(analyzeSelectionInWorker(samples, 48_000, {
      workerModuleUrl: "worker.js",
    })).resolves.toBe(derived);
    expect(posted).toHaveLength(1);
    expect(posted[0].message).toMatchObject({
      type: "analyze-selection",
      sampleRateHz: 48_000,
      frameSize: 2_048,
    });
    expect(posted[0].transfer).toEqual([samples.buffer]);
    expect(terminate).toHaveBeenCalledOnce();
  });

  it("uses a production worker factory without constructing a URL worker", async () => {
    const derived = selectionAnalysis();
    const globalConstruct = vi.fn();
    vi.stubGlobal("Worker", function WorkerStub() { globalConstruct(); });
    const factory = vi.fn(() => {
      const worker = {
        onmessage: null as ((event: MessageEvent) => void) | null,
        onerror: null,
        postMessage(message: WorkerSelectionMessage) {
          queueMicrotask(() => worker.onmessage?.({
          data: { type: "selection-result", requestId: message.requestId, result: derived },
          } as MessageEvent));
        },
        terminate: vi.fn(),
      };
      return worker as unknown as Worker;
    });

    await expect(analyzeSelectionInWorker(new Float32Array(2_048), 48_000, {
      workerFactory: factory,
    })).resolves.toBe(derived);

    expect(factory).toHaveBeenCalledOnce();
    expect(globalConstruct).not.toHaveBeenCalled();
  });
});
