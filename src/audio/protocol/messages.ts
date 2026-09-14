import type { AudioFrame, QueueStatus } from "../analysis/contracts";
import type { AudioSelectionSummary, FrameAnalysis, TemporalHypotheses } from "../analysis/analysis";

export type WorkletCreditMessage = Readonly<{ type: "credits"; count: number }>;
export type WorkletAttachMessage = Readonly<{ type: "attach-output"; port: MessagePort }>;
export type WorkletStopMessage = Readonly<{ type: "stop-capture" }>;
export type WorkerAttachMessage = Readonly<{
  type: "attach-input";
  port: MessagePort;
  queueCapacity: number;
  onsetSensitivity?: number;
}>;
export type WorkerFrameMessage = Readonly<{ type: "audio-frame"; frame: AudioFrame }>;
export type WorkerStreamEndMessage = Readonly<{ type: "audio-stream-end" }>;
export type WorkerSelectionMessage = Readonly<{
  type: "analyze-selection";
  requestId: string;
  samples: Float32Array;
  sampleRateHz: number;
  frameSize: 2048 | 4096;
  onsetSensitivity?: number;
}>;
export type WorkerResultMessage = Readonly<{
  type: "analysis-result";
  result: FrameAnalysis;
  temporal: TemporalHypotheses;
  queue: QueueStatus;
}>;
export type WorkerCompleteMessage = Readonly<{
  type: "analysis-complete";
  result: FrameAnalysis | null;
  temporal: TemporalHypotheses;
  queue: QueueStatus;
}>;
export type WorkerSelectionResultMessage = Readonly<{
  type: "selection-result";
  requestId: string;
  result: AudioSelectionSummary;
}>;
export type WorkerErrorMessage = Readonly<{ type: "analysis-error"; requestId?: string; message: string }>;
export type AnalysisWorkerMessage = WorkerResultMessage | WorkerCompleteMessage | WorkerSelectionResultMessage | WorkerErrorMessage;
