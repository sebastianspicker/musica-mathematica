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
  const queue = new BoundedAudioFrameQueue(event.data.queueCapacity);
  const fluxHistory: number[] = [];
  let previousMagnitudes: Float64Array | null = null;
  inputPort.onmessage = (frameEvent: MessageEvent<unknown>) => {
    if (!isWorkerFrameMessage(frameEvent.data)) return;
    try {
      const queueStatus = queue.push(frameEvent.data.frame);
      const nextFrame = queue.shift();
      if (queueStatus.accepted && nextFrame) {
        const result = analyzeAudioFrame(nextFrame, analyzeSpectrumWithFftJs);
        const maximumHistoryFrames = Math.ceil(
          AUDIO_ANALYSIS_LIMITS.maximumMicrophoneSeconds * nextFrame.sampleRateHz / (nextFrame.samples.length / 2),
        );
        for (let missing = 0; missing < nextFrame.droppedBefore; missing += 1) fluxHistory.push(0);
        const flux = previousMagnitudes && nextFrame.droppedBefore === 0
          ? spectralFlux(result.spectrum.magnitudes, previousMagnitudes)
          : 0;
        fluxHistory.push(flux);
        if (fluxHistory.length > maximumHistoryFrames) {
          fluxHistory.splice(0, fluxHistory.length - maximumHistoryFrames);
        }
        previousMagnitudes = result.spectrum.magnitudes;
        const temporal = analyzeFluxHistory(
          fluxHistory,
          nextFrame.sampleRateHz,
          nextFrame.samples.length / 2,
          event.data.onsetSensitivity,
        );
        const message: AnalysisWorkerMessage = {
          type: "analysis-result",
          result,
          temporal,
          queue: queue.getStatus(),
        };
        workerScope.postMessage(message);
      }
    } catch (error) {
      const message: AnalysisWorkerMessage = {
        type: "analysis-error",
        message: error instanceof Error ? error.message : "Unknown audio-analysis error",
      };
      workerScope.postMessage(message);
    } finally {
      const credit: WorkletCreditMessage = { type: "credits", count: 1 };
      inputPort.postMessage(credit);
    }
  };
  inputPort.start();
  const initialCredit: WorkletCreditMessage = { type: "credits", count: event.data.queueCapacity };
  inputPort.postMessage(initialCredit);
};

export {};
