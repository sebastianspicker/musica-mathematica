import {
  AUDIO_ANALYSIS_LIMITS,
  assertSupportedFrameSize,
  sampleRateValidationError,
  selectionDurationValidationError,
  type QueueStatus,
} from "../analysis/contracts";
import type { AudioSelectionSummary, FrameAnalysis, TemporalHypotheses } from "../analysis/analysis";
import type {
  AnalysisWorkerMessage,
  WorkerAttachMessage,
  WorkerSelectionMessage,
  WorkletAttachMessage,
  WorkletStopMessage,
} from "../protocol/messages";

export type StreamingAnalysisCompletion = Readonly<{
  result: FrameAnalysis | null;
  queue: QueueStatus;
  temporal: TemporalHypotheses;
}>;

export type AnalysisPipeline = Readonly<{
  /** Gracefully ends capture through the ordered worklet-to-worker channel. */
  finish(): Promise<StreamingAnalysisCompletion>;
  /** Immediately tears down capture and analysis without publishing completion. */
  stop(): void;
}>;

export type AnalysisPipelineOptions = Readonly<{
  workletModuleUrl: URL | string;
  workerModuleUrl?: URL | string;
  workerFactory?: () => Worker;
  frameSize?: 2048 | 4096;
  queueCapacity?: number;
  onsetSensitivity?: number;
  completionTimeoutMilliseconds?: number;
  onResult(result: FrameAnalysis, queue: QueueStatus, temporal: TemporalHypotheses): void;
  onError?(message: string): void;
}>;

export type PreparedAnalysisPipeline = Readonly<{
  connect(stream: MediaStream): Promise<AnalysisPipeline>;
  stop(): void;
}>;

/** Starts worker and worklet setup without retaining or requesting a media stream. */
export function prepareMicrophoneAnalysisPipeline(
  context: AudioContext,
  options: AnalysisPipelineOptions,
): PreparedAnalysisPipeline {
  const settings = validatePipelineOptions(options);
  const worker = createWorker(
    options.workerModuleUrl,
    options.workerFactory,
    "musica-mathematica-audio-analysis",
  );
  let stopped = false;
  let connected = false;
  let setupError: unknown;
  let stopConnectedPipeline: (() => void) | null = null;
  let finishPreparation: () => void = () => undefined;
  const preparationEnded = new Promise<void>((resolve) => { finishPreparation = resolve; });

  const stop = () => {
    if (stopped) return;
    stopped = true;
    finishPreparation();
    if (stopConnectedPipeline) stopConnectedPipeline();
    else worker.terminate();
  };

  const failPreparation = (error: unknown) => {
    if (stopped) return;
    setupError = error instanceof Error ? error : new Error("Audio analysis setup failed.");
    stop();
    options.onError?.((setupError as Error).message);
  };
  worker.onerror = (event) => {
    failPreparation(new Error(event.message || "Audio analysis worker failed."));
  };
  let workletReady: Promise<void>;
  try {
    workletReady = context.audioWorklet.addModule(options.workletModuleUrl).catch(failPreparation);
  } catch (error) {
    failPreparation(error);
    workletReady = Promise.resolve();
  }

  return Object.freeze({
    async connect(stream: MediaStream): Promise<AnalysisPipeline> {
      if (connected) throw new Error("Prepared audio analysis can connect only once.");
      connected = true;
      await Promise.race([workletReady, preparationEnded]);
      if (setupError) {
        stopTracks(stream);
        throw setupError;
      }
      if (stopped) {
        stopTracks(stream);
        throw cancellationError();
      }
      try {
        const pipeline = connectPreparedPipeline(context, stream, worker, options, settings);
        stopConnectedPipeline = pipeline.stop;
        return pipeline;
      } catch (error) {
        stopTracks(stream);
        worker.terminate();
        throw error;
      }
    },
    stop,
  });
}

/** Connects capture directly to a worker MessagePort; feature extraction never runs on the main thread. */
export async function createMicrophoneAnalysisPipeline(
  context: AudioContext,
  stream: MediaStream,
  options: AnalysisPipelineOptions,
): Promise<AnalysisPipeline> {
  const prepared = prepareMicrophoneAnalysisPipeline(context, options);
  try {
    return await prepared.connect(stream);
  } catch (error) {
    prepared.stop();
    throw error;
  }
}

type ValidatedPipelineSettings = Readonly<{
  frameSize: 2048 | 4096;
  queueCapacity: number;
  completionTimeoutMilliseconds: number;
}>;

function validatePipelineOptions(options: AnalysisPipelineOptions): ValidatedPipelineSettings {
  const frameSize = options.frameSize ?? 2048;
  assertSupportedFrameSize(frameSize);
  const queueCapacity = options.queueCapacity ?? AUDIO_ANALYSIS_LIMITS.defaultQueueCapacity;
  if (!Number.isSafeInteger(queueCapacity) || queueCapacity <= 0) {
    throw new RangeError("queueCapacity must be a positive safe integer");
  }
  const completionTimeoutMilliseconds = options.completionTimeoutMilliseconds ?? 1_000;
  if (!Number.isFinite(completionTimeoutMilliseconds) || completionTimeoutMilliseconds <= 0) {
    throw new RangeError("completionTimeoutMilliseconds must be positive and finite");
  }
  return { frameSize, queueCapacity, completionTimeoutMilliseconds };
}

function connectPreparedPipeline(
  context: AudioContext,
  stream: MediaStream,
  worker: Worker,
  options: AnalysisPipelineOptions,
  settings: ValidatedPipelineSettings,
): AnalysisPipeline {
  const channel = new MessageChannel();
  const source = context.createMediaStreamSource(stream);
  const captureNode = new AudioWorkletNode(context, "musica-mathematica-capture", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { frameSize: settings.frameSize },
  });
  const silentOutput = context.createGain();
  silentOutput.gain.value = 0;
  source.connect(captureNode).connect(silentOutput).connect(context.destination);

  let stopped = false;
  let finishing: Promise<StreamingAnalysisCompletion> | null = null;
  let resolveFinish: ((completion: StreamingAnalysisCompletion) => void) | null = null;
  let rejectFinish: ((error: Error) => void) | null = null;
  let completionTimer: ReturnType<typeof setTimeout> | null = null;

  const disconnect = () => {
    source.disconnect();
    captureNode.disconnect();
    silentOutput.disconnect();
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (completionTimer !== null) clearTimeout(completionTimer);
    completionTimer = null;
    stopTracks(stream);
    disconnect();
    worker.terminate();
    rejectFinish?.(cancellationError());
    resolveFinish = null;
    rejectFinish = null;
  };
  const finishWithError = (error: Error) => {
    const reject = rejectFinish;
    resolveFinish = null;
    rejectFinish = null;
    stop();
    reject?.(error);
    options.onError?.(error.message);
  };
  const finishWithResult = (completion: StreamingAnalysisCompletion) => {
    if (stopped) return;
    if (completionTimer !== null) clearTimeout(completionTimer);
    completionTimer = null;
    if (completion.result) options.onResult(completion.result, completion.queue, completion.temporal);
    resolveFinish?.(completion);
    resolveFinish = null;
    rejectFinish = null;
    stopped = true;
    disconnect();
    worker.terminate();
  };

  worker.onmessage = (event: MessageEvent<AnalysisWorkerMessage>) => {
    if (stopped) return;
    if (event.data.type === "analysis-result") {
      options.onResult(event.data.result, event.data.queue, event.data.temporal);
    } else if (event.data.type === "analysis-complete") {
      finishWithResult(event.data);
    } else if (event.data.type === "analysis-error") {
      options.onError?.(event.data.message);
    }
  };
  worker.onerror = (event) => {
    finishWithError(new Error(event.message || "Audio analysis worker failed."));
  };

  const workletAttach: WorkletAttachMessage = { type: "attach-output", port: channel.port1 };
  captureNode.port.postMessage(workletAttach, [channel.port1]);
  const workerAttach: WorkerAttachMessage = {
    type: "attach-input",
    port: channel.port2,
    queueCapacity: settings.queueCapacity,
    ...(options.onsetSensitivity === undefined ? {} : { onsetSensitivity: options.onsetSensitivity }),
  };
  worker.postMessage(workerAttach, [channel.port2]);

  return Object.freeze({
    finish() {
      if (finishing) return finishing;
      if (stopped) return Promise.reject(cancellationError());
      finishing = new Promise<StreamingAnalysisCompletion>((resolve, reject) => {
        resolveFinish = resolve;
        rejectFinish = reject;
      });
      const endCapture: WorkletStopMessage = { type: "stop-capture" };
      captureNode.port.postMessage(endCapture);
      stopTracks(stream);
      source.disconnect();
      completionTimer = setTimeout(() => {
        finishWithError(new Error("Audio analysis did not finish within 1 second of capture ending."));
      }, settings.completionTimeoutMilliseconds);
      return finishing;
    },
    stop,
  });
}

function stopTracks(stream: MediaStream): void {
  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

function cancellationError(): DOMException {
  return new DOMException("Audio analysis was cancelled.", "AbortError");
}

export type SelectionAnalysisWorkerOptions = Readonly<{
  workerModuleUrl?: URL | string;
  workerFactory?: () => Worker;
  frameSize?: 2048 | 4096;
  onsetSensitivity?: number;
  signal?: AbortSignal;
}>;

/** Transfers one bounded selection and resolves with its compact derived summary. */
export function analyzeSelectionInWorker(
  samples: Float32Array,
  sampleRateHz: number,
  options: SelectionAnalysisWorkerOptions,
): Promise<AudioSelectionSummary> {
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
      reject(cancellationError());
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
