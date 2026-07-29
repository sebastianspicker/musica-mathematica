/// <reference lib="webworker" />

import { analyzeAudioFrame, analyzeAudioSelection, analyzeFluxHistory } from "./analysis";
import { AUDIO_ANALYSIS_LIMITS, BoundedAudioFrameQueue } from "./contracts";
import { spectralFlux } from "./features";
import { analyzeSpectrumWithFftJs } from "./fftJsAdapter";
import type {
  AnalysisWorkerMessage,
  WorkerAttachMessage,
  WorkerFrameMessage,
  WorkerSelectionMessage,
  WorkletCreditMessage,
} from "./workerProtocol";

const workerScope = self as DedicatedWorkerGlobalScope;

function isWorkerFrameMessage(message: unknown): message is WorkerFrameMessage {
  return typeof message === "object"
    && message !== null
    && (message as { type?: unknown }).type === "audio-frame";
}

type FrameAnalysisState = {
  readonly queue: BoundedAudioFrameQueue;
  readonly fluxHistory: number[];
  previousMagnitudes: Float64Array | null;
  readonly onsetSensitivity: number | undefined;
};

function processWorkerFrame(message: WorkerFrameMessage, state: FrameAnalysisState): void {
  const queueStatus = state.queue.push(message.frame);
  const nextFrame = state.queue.shift();
  if (!queueStatus.accepted || !nextFrame) return;

  const result = analyzeAudioFrame(nextFrame, analyzeSpectrumWithFftJs);
  const maximumHistoryFrames = Math.ceil(
    AUDIO_ANALYSIS_LIMITS.maximumMicrophoneSeconds * nextFrame.sampleRateHz / (nextFrame.samples.length / 2),
  );
  for (let missing = 0; missing < nextFrame.droppedBefore; missing += 1) state.fluxHistory.push(0);
  const flux = state.previousMagnitudes && nextFrame.droppedBefore === 0
    ? spectralFlux(result.spectrum.magnitudes, state.previousMagnitudes)
    : 0;
  state.fluxHistory.push(flux);
  if (state.fluxHistory.length > maximumHistoryFrames) {
    state.fluxHistory.splice(0, state.fluxHistory.length - maximumHistoryFrames);
  }
  state.previousMagnitudes = result.spectrum.magnitudes;
  const temporal = analyzeFluxHistory(
    state.fluxHistory,
    nextFrame.sampleRateHz,
    nextFrame.samples.length / 2,
    state.onsetSensitivity,
  );
  const response: AnalysisWorkerMessage = {
    type: "analysis-result",
    result,
    temporal,
    queue: state.queue.getStatus(),
  };
  workerScope.postMessage(response);
}

function handleWorkerFrame(message: unknown, inputPort: MessagePort, state: FrameAnalysisState): void {
  if (!isWorkerFrameMessage(message)) return;
  try {
    processWorkerFrame(message, state);
  } catch (error) {
    const response: AnalysisWorkerMessage = {
      type: "analysis-error",
      message: error instanceof Error ? error.message : "Unknown audio-analysis error",
    };
    workerScope.postMessage(response);
  } finally {
    const credit: WorkletCreditMessage = { type: "credits", count: 1 };
    inputPort.postMessage(credit);
  }
}

workerScope.onmessage = (event: MessageEvent<WorkerAttachMessage | WorkerSelectionMessage>) => {
  if (event.data.type === "analyze-selection") {
    try {
      const result = analyzeAudioSelection(
        event.data.samples,
        event.data.sampleRateHz,
        analyzeSpectrumWithFftJs,
        { frameSize: event.data.frameSize, onsetSensitivity: event.data.onsetSensitivity },
      );
      const message: AnalysisWorkerMessage = {
        type: "selection-result",
        requestId: event.data.requestId,
        result,
      };
      workerScope.postMessage(message);
    } catch (error) {
      const message: AnalysisWorkerMessage = {
        type: "analysis-error",
        requestId: event.data.requestId,
        message: error instanceof Error ? error.message : "Unknown audio-analysis error",
      };
      workerScope.postMessage(message);
    }
    return;
  }
  const inputPort = event.data.port;
  const state: FrameAnalysisState = {
    queue: new BoundedAudioFrameQueue(event.data.queueCapacity),
    fluxHistory: [],
    previousMagnitudes: null,
    onsetSensitivity: event.data.onsetSensitivity,
  };
  inputPort.onmessage = (frameEvent: MessageEvent<unknown>) => {
    handleWorkerFrame(frameEvent.data, inputPort, state);
  };
  inputPort.start();
  const initialCredit: WorkletCreditMessage = { type: "credits", count: event.data.queueCapacity };
  inputPort.postMessage(initialCredit);
};

export {};
