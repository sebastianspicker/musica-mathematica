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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWorkerFrameMessage(message: unknown): message is WorkerFrameMessage {
  if (!isObjectRecord(message) || message.type !== "audio-frame" || !isObjectRecord(message.frame)) return false;
  const frame = message.frame;
  const numericFields = [frame.sequence, frame.startSample, frame.sampleRateHz, frame.droppedBefore];
  return numericFields.every((value) => typeof value === "number") && frame.samples instanceof Float32Array;
}

function postAnalysisError(error: unknown, requestId?: string): void {
  const message: AnalysisWorkerMessage = {
    type: "analysis-error",
    ...(requestId === undefined ? {} : { requestId }),
    message: error instanceof Error ? error.message : "Unknown audio-analysis error",
  };
  workerScope.postMessage(message);
}

function handleSelectionAnalysis(message: WorkerSelectionMessage): void {
  try {
    const result = analyzeAudioSelection(
      message.samples,
      message.sampleRateHz,
      analyzeSpectrumWithFftJs,
      { frameSize: message.frameSize, onsetSensitivity: message.onsetSensitivity },
    );
    const response: AnalysisWorkerMessage = {
      type: "selection-result",
      requestId: message.requestId,
      result,
    };
    workerScope.postMessage(response);
  } catch (error) {
    postAnalysisError(error, message.requestId);
  }
}

type StreamingAnalysisSession = {
  readonly inputPort: MessagePort;
  readonly queue: BoundedAudioFrameQueue;
  readonly fluxHistory: number[];
  readonly onsetSensitivity?: number;
  previousMagnitudes: Float64Array | null;
};

function handleStreamingFrame(session: StreamingAnalysisSession, message: WorkerFrameMessage): void {
  try {
    const queueStatus = session.queue.push(message.frame);
    const nextFrame = session.queue.shift();
    if (queueStatus.accepted && nextFrame) {
      const result = analyzeAudioFrame(nextFrame, analyzeSpectrumWithFftJs);
      const maximumHistoryFrames = Math.ceil(
        AUDIO_ANALYSIS_LIMITS.maximumMicrophoneSeconds * nextFrame.sampleRateHz / (nextFrame.samples.length / 2),
      );
      for (let missing = 0; missing < nextFrame.droppedBefore; missing += 1) session.fluxHistory.push(0);
      const flux = session.previousMagnitudes && nextFrame.droppedBefore === 0
        ? spectralFlux(result.spectrum.magnitudes, session.previousMagnitudes)
        : 0;
      session.fluxHistory.push(flux);
      if (session.fluxHistory.length > maximumHistoryFrames) {
        session.fluxHistory.splice(0, session.fluxHistory.length - maximumHistoryFrames);
      }
      session.previousMagnitudes = result.spectrum.magnitudes;
      const temporal = analyzeFluxHistory(
        session.fluxHistory,
        nextFrame.sampleRateHz,
        nextFrame.samples.length / 2,
        session.onsetSensitivity,
      );
      const response: AnalysisWorkerMessage = {
        type: "analysis-result",
        result,
        temporal,
        queue: session.queue.getStatus(),
      };
      workerScope.postMessage(response);
    }
  } catch (error) {
    postAnalysisError(error);
  } finally {
    const credit: WorkletCreditMessage = { type: "credits", count: 1 };
    session.inputPort.postMessage(credit);
  }
}

function attachStreamingAnalysis(message: WorkerAttachMessage): void {
  const session: StreamingAnalysisSession = {
    inputPort: message.port,
    queue: new BoundedAudioFrameQueue(message.queueCapacity),
    fluxHistory: [],
    onsetSensitivity: message.onsetSensitivity,
    previousMagnitudes: null,
  };
  session.inputPort.onmessage = (frameEvent: MessageEvent<unknown>) => {
    if (!isWorkerFrameMessage(frameEvent.data)) return;
    handleStreamingFrame(session, frameEvent.data);
  };
  session.inputPort.start();
  const initialCredit: WorkletCreditMessage = { type: "credits", count: message.queueCapacity };
  session.inputPort.postMessage(initialCredit);
}

workerScope.onmessage = (event: MessageEvent<WorkerAttachMessage | WorkerSelectionMessage>) => {
  if (event.data.type === "analyze-selection") {
    handleSelectionAnalysis(event.data);
    return;
  }
  attachStreamingAnalysis(event.data);
};

export {};
