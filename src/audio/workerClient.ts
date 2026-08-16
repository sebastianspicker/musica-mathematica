import {
  AUDIO_ANALYSIS_LIMITS,
  assertSupportedFrameSize,
  sampleRateValidationError,
  selectionDurationValidationError,
  type QueueStatus,
} from "./contracts";
import type { AudioSelectionAnalysis, FrameAnalysis, TemporalHypotheses } from "./analysis";
import type {
  AnalysisWorkerMessage,
  WorkerAttachMessage,
  WorkerSelectionMessage,
  WorkletAttachMessage,
} from "./workerProtocol";

export type AnalysisPipeline = Readonly<{
  stop(): void;
}>;

export type AnalysisPipelineOptions = Readonly<{
  workletModuleUrl: URL | string;
  workerModuleUrl?: URL | string;
  workerFactory?: () => Worker;
  frameSize?: 2048 | 4096;
  queueCapacity?: number;
  onsetSensitivity?: number;
  onResult(result: FrameAnalysis, queue: QueueStatus, temporal: TemporalHypotheses): void;
  onError?(message: string): void;
}>;

/** Connects capture directly to a worker MessagePort; feature extraction never runs on the main thread. */
export async function createMicrophoneAnalysisPipeline(
  context: AudioContext,
  stream: MediaStream,
  options: AnalysisPipelineOptions,
): Promise<AnalysisPipeline> {
  const frameSize = options.frameSize ?? 2048;
  assertSupportedFrameSize(frameSize);
  const queueCapacity = options.queueCapacity ?? AUDIO_ANALYSIS_LIMITS.defaultQueueCapacity;
  if (!Number.isSafeInteger(queueCapacity) || queueCapacity <= 0) {
    throw new RangeError("queueCapacity must be a positive safe integer");
  }
  await context.audioWorklet.addModule(options.workletModuleUrl);
  const worker = createWorker(
    options.workerModuleUrl,
    options.workerFactory,
    "musica-mathematica-audio-analysis",
  );
  const channel = new MessageChannel();
  const source = context.createMediaStreamSource(stream);
  const captureNode = new AudioWorkletNode(context, "musica-mathematica-capture", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { frameSize },
  });
  const silentOutput = context.createGain();
  silentOutput.gain.value = 0;
  source.connect(captureNode).connect(silentOutput).connect(context.destination);

  worker.onmessage = (event: MessageEvent<AnalysisWorkerMessage>) => {
    if (event.data.type === "analysis-result") {
      options.onResult(event.data.result, event.data.queue, event.data.temporal);
    } else if (event.data.type === "analysis-error") {
      options.onError?.(event.data.message);
    }
  };
  worker.onerror = (event) => options.onError?.(event.message || "Audio analysis worker failed.");

  const workletAttach: WorkletAttachMessage = { type: "attach-output", port: channel.port1 };
  captureNode.port.postMessage(workletAttach, [channel.port1]);
  const workerAttach: WorkerAttachMessage = {
    type: "attach-input",
    port: channel.port2,
    queueCapacity,
    ...(options.onsetSensitivity === undefined ? {} : { onsetSensitivity: options.onsetSensitivity }),
  };
  worker.postMessage(workerAttach, [channel.port2]);

  let stopped = false;
  return Object.freeze({
    stop() {
      if (stopped) return;
      stopped = true;
      source.disconnect();
      captureNode.disconnect();
      silentOutput.disconnect();
      worker.terminate();
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    },
  });
}

export type SelectionAnalysisWorkerOptions = Readonly<{
  workerModuleUrl?: URL | string;
  workerFactory?: () => Worker;
  frameSize?: 2048 | 4096;
  onsetSensitivity?: number;
  signal?: AbortSignal;
}>;

/**
 * Transfers one bounded selection to the local analysis worker and terminates
 * the worker after the derived result. The supplied Float32Array must own its
 * complete ArrayBuffer and is detached by the transfer.
 */
export function analyzeSelectionInWorker(
  samples: Float32Array,
  sampleRateHz: number,
  options: SelectionAnalysisWorkerOptions,
): Promise<AudioSelectionAnalysis> {
  const frameSize = options.frameSize ?? 2048;
  assertSupportedFrameSize(frameSize);
  const sampleRateError = sampleRateValidationError(sampleRateHz);
  if (sampleRateError) return Promise.reject(sampleRateError);
  if (!(samples.buffer instanceof ArrayBuffer)
      || samples.byteOffset !== 0
      || samples.byteLength !== samples.buffer.byteLength) {
    return Promise.reject(new RangeError("samples must own their complete transferable ArrayBuffer"));
  }
  const durationError = selectionDurationValidationError(samples.length, sampleRateHz);
  if (durationError) return Promise.reject(durationError);
  return new Promise((resolve, reject) => {
    const worker = createWorker(
      options.workerModuleUrl,
      options.workerFactory,
      "musica-mathematica-selection-analysis",
    );
    const requestId = "bounded-selection";
    const finish = () => {
      options.signal?.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(new DOMException("Audio analysis was cancelled.", "AbortError"));
    };
    if (options.signal?.aborted) {
      abort();
      return;
    }
    options.signal?.addEventListener("abort", abort, { once: true });
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "Audio analysis worker failed."));
    };
    worker.onmessage = (event: MessageEvent<AnalysisWorkerMessage>) => {
      if (event.data.type === "selection-result" && event.data.requestId === requestId) {
        finish();
        resolve(event.data.result);
      } else if (event.data.type === "analysis-error" && event.data.requestId === requestId) {
        finish();
        reject(new Error(event.data.message));
      }
    };
    const message: WorkerSelectionMessage = {
      type: "analyze-selection",
      requestId,
      samples,
      sampleRateHz,
      frameSize,
      onsetSensitivity: options.onsetSensitivity,
    };
    try {
      worker.postMessage(message, [samples.buffer]);
    } catch (error) {
      finish();
      reject(error instanceof Error ? error : new Error("Audio analysis worker could not receive the selection."));
    }
  });
}

function createWorker(
  workerModuleUrl: URL | string | undefined,
  workerFactory: (() => Worker) | undefined,
  name: string,
): Worker {
  if (workerFactory) return workerFactory();
  if (workerModuleUrl == null) {
    throw new TypeError("workerFactory or workerModuleUrl is required");
  }
  return new Worker(workerModuleUrl, { type: "module", name });
}
