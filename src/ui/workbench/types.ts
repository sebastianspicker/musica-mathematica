import type { FormEvent } from "react";
import type { EvaluationOutput, FactorValue, InputMode } from "../../curriculum/contracts";
import type { LessonResponseField } from "../../learning/stages";

export type InquiryMessage = Readonly<{
  text: string;
  /** Routine confirmations are announced quietly; everything else is shown. */
  routine: boolean;
}>;

export type PulseAudioView = Readonly<{
  audioEnabled: boolean;
  audioVolume: number;
  audioUnavailableReason: string | null;
  setAudioEnabled: (enabled: boolean) => void;
  setAudioVolume: (volume: number) => void;
}>;

export type LessonWorkbenchRuntimeView = Readonly<{
  audio: PulseAudioView;
  audioAnalysisReady?: boolean;
  comparison: Readonly<{ reason: string }>;
  evaluation: EvaluationOutput;
  experimentActive: boolean;
  factors: Record<string, FactorValue>;
  inputMode: InputMode;
  message: InquiryMessage | null;
  motionEnabled: boolean;
  note: string;
  recordLabel: string;
  beginPrediction: () => void;
  changeInputMode: (mode: InputMode) => void;
  openComparison: () => void;
  openInterpretation: () => void;
  recordCurrentRun: () => void;
  resetPlayback: () => void;
  restartLesson: () => void;
  savePrediction: (event: FormEvent<HTMLFormElement>) => void;
  saveResponse: (
    event: FormEvent<HTMLFormElement>,
    field: LessonResponseField,
    nextStage: "perform" | "transfer" | "debrief",
  ) => void;
  setMotionEnabled: (enabled: boolean) => void;
  setNote: (note: string) => void;
  stepPlayback: () => void;
  togglePlayback: () => void;
  updateFactor: (factorId: string, value: FactorValue) => void;
}>;
