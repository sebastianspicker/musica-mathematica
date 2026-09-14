import type { FormEvent } from "react";
import type { EvaluationOutput, FactorValue, InputMode } from "../../curriculum/contracts";

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
  message: string | null;
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
    field: "explanation" | "performanceReflection" | "transferResponse",
    nextStage: "perform" | "transfer" | "debrief",
  ) => void;
  setMotionEnabled: (enabled: boolean) => void;
  setNote: (note: string) => void;
  stepPlayback: () => void;
  togglePlayback: () => void;
  updateFactor: (factorId: string, value: FactorValue) => void;
}>;
