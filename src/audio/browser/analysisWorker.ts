/// <reference lib="webworker" />

import {
  analyzeAudioFrame,
  analyzeAudioSelection,
  analyzeFluxHistory,
  summarizeAudioSelection,
  type FrameAnalysis,
  type TemporalHypotheses,
} from "../analysis/analysis";
import { AUDIO_ANALYSIS_LIMITS } from "../analysis/contracts";
import { spectralFlux } from "../analysis/features";
import { analyzeSpectrumWithFftJs } from "../analysis/fftJsAdapter";
import { BoundedAudioFrameQueue } from "../protocol/frameQueue";
import type {
  AnalysisWorkerMessage,
  WorkerAttachMessage,
  WorkerFrameMessage,
  WorkerSelectionMessage,
  WorkerStreamEndMessage,
  WorkletCreditMessage,
} from "../protocol/messages";

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

function isWorkerStreamEndMessage(message: unknown): message is WorkerStreamEndMessage {
  return isObjectRecord(message) && message.type === "audio-stream-end";
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
    const analysis = analyzeAudioSelection(
      message.samples,
      message.sampleRateHz,
      analyzeSpectrumWithFftJs,
      { frameSize: message.frameSize, onsetSensitivity: message.onsetSensitivity },
    );
    const response: AnalysisWorkerMessage = {
      type: "selection-result",
      requestId: message.requestId,
      result: summarizeAudioSelection(analysis),
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
  accepting: boolean;
  previousMagnitudes: Float64Array | null;
  latestResult: FrameAnalysis | null;
  latestTemporal: TemporalHypotheses;
  lastPublishedStartSeconds: number | null;
  sampleRateHz: number | null;
  hopSize: number | null;
};

const TEMPORAL_PUBLICATION_INTERVAL_SECONDS = 0.25;
const EMPTY_TEMPORAL: TemporalHypotheses = Object.freeze({
  onsetTimesSeconds: Object.freeze([]),
  tempoHypotheses: Object.freeze([]),
  meterHypotheses: Object.freeze([]),
});

function handleStreamingFrame(session: StreamingAnalysisSession, message: WorkerFrameMessage): void {
  try {
    if (!session.accepting) return;
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
      session.latestResult = result;
      session.sampleRateHz = nextFrame.sampleRateHz;
      session.hopSize = nextFrame.samples.length / 2;
      if (shouldPublishTemporal(session, result.startSeconds)) publishStreamingResult(session);
    }
  } catch (error) {
    postAnalysisError(error);
  } finally {
    const credit: WorkletCreditMessage = { type: "credits", count: 1 };
    session.inputPort.postMessage(credit);
  }
}

function shouldPublishTemporal(session: StreamingAnalysisSession, startSeconds: number): boolean {
  return session.lastPublishedStartSeconds === null
    || startSeconds - session.lastPublishedStartSeconds >= TEMPORAL_PUBLICATION_INTERVAL_SECONDS;
}

function updateTemporal(session: StreamingAnalysisSession): TemporalHypotheses {
  if (session.sampleRateHz === null || session.hopSize === null) return EMPTY_TEMPORAL;
  session.latestTemporal = analyzeFluxHistory(
    session.fluxHistory,
    session.sampleRateHz,
    session.hopSize,
    session.onsetSensitivity,
  );
  return session.latestTemporal;
}

function publishStreamingResult(session: StreamingAnalysisSession): void {
  const result = session.latestResult;
  if (!result) return;
  const response: AnalysisWorkerMessage = {
    type: "analysis-result",
    result,
    temporal: updateTemporal(session),
    queue: session.queue.getStatus(),
  };
  session.lastPublishedStartSeconds = result.startSeconds;
  workerScope.postMessage(response);
}

function completeStreamingAnalysis(session: StreamingAnalysisSession): void {
  if (!session.accepting) return;
  session.accepting = false;
  const response: AnalysisWorkerMessage = {
    type: "analysis-complete",
    result: session.latestResult,
    temporal: updateTemporal(session),
    queue: session.queue.getStatus(),
  };
  workerScope.postMessage(response);
}

function attachStreamingAnalysis(message: WorkerAttachMessage): void {
  const session: StreamingAnalysisSession = {
    inputPort: message.port,
    queue: new BoundedAudioFrameQueue(message.queueCapacity),
    fluxHistory: [],
    onsetSensitivity: message.onsetSensitivity,
    accepting: true,
    previousMagnitudes: null,
    latestResult: null,
    latestTemporal: EMPTY_TEMPORAL,
    lastPublishedStartSeconds: null,
    sampleRateHz: null,
    hopSize: null,
  };
  session.inputPort.onmessage = (frameEvent: MessageEvent<unknown>) => {
    if (isWorkerFrameMessage(frameEvent.data)) {
      handleStreamingFrame(session, frameEvent.data);
    } else if (isWorkerStreamEndMessage(frameEvent.data)) {
      completeStreamingAnalysis(session);
    }
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
