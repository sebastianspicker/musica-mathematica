import type { AudioFrame, QueueStatus } from "./contracts";
import type { AudioSelectionAnalysis, FrameAnalysis, TemporalHypotheses } from "./analysis";

export type WorkletCreditMessage = Readonly<{ type: "credits"; count: number }>;
export type WorkletAttachMessage = Readonly<{ type: "attach-output"; port: MessagePort }>;
export type WorkerAttachMessage = Readonly<{
  type: "attach-input";
  port: MessagePort;
  queueCapacity: number;
  onsetSensitivity?: number;
}>;
export type WorkerFrameMessage = Readonly<{ type: "audio-frame"; frame: AudioFrame }>;
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
export type WorkerSelectionResultMessage = Readonly<{
  type: "selection-result";
  requestId: string;
  result: AudioSelectionAnalysis;
}>;
export type WorkerErrorMessage = Readonly<{ type: "analysis-error"; requestId?: string; message: string }>;
export type AnalysisWorkerMessage = WorkerResultMessage | WorkerSelectionResultMessage | WorkerErrorMessage;
