export const labIds = [
  "phase-proportion",
  "ensemble-dynamics",
  "rhythm-meter",
  "pitch-tuning",
  "harmony-geometry",
  "timbre-acoustics",
  "probability-form",
  "measurement-inference",
] as const;

export type LabId = (typeof labIds)[number];

export const claimKinds = [
  "definition-or-theorem",
  "computed-model-result",
  "measured-observation",
  "transcription-hypothesis",
  "empirical-literature",
  "heuristic",
  "recommendation",
] as const;

export type ClaimKind = (typeof claimKinds)[number];
export type FactorValue = string | number | boolean;
export type InputMode = "synthetic" | "microphone" | "file";
export type CalibrationStatus = "uncalibrated";

export type ClaimRecord = Readonly<{
  id: string;
  kind: ClaimKind;
  statement: string;
  scope: string;
  assumptions: readonly string[];
  sourceIds: readonly string[];
  allowedInference: string;
  forbiddenInference: string;
}>;

export type NumberFactor = Readonly<{
  id: string;
  kind: "number";
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
  help: string;
}>;

export type SelectFactor = Readonly<{
  id: string;
  kind: "select";
  label: string;
  defaultValue: string;
  options: readonly Readonly<{ value: string; label: string }>[];
  help: string;
}>;

export type ToggleFactor = Readonly<{
  id: string;
  kind: "toggle";
  label: string;
  defaultValue: boolean;
  help: string;
}>;

export type FactorDefinition = NumberFactor | SelectFactor | ToggleFactor;

export type ObservableRecord = Readonly<{
  id: string;
  label: string;
  value: number | string;
  unit: string | null;
  aggregation: "instantaneous" | "terminal-mean" | "range" | "distribution";
  claimId: string;
  precision?: number;
}>;

export type TracePoint = Readonly<{
  x: number;
  y: number;
  series: string;
}>;

export type TraceAxis = Readonly<{
  label: string;
  unit: string | null;
}>;

export type TraceAxes = Readonly<{
  x: TraceAxis;
  y: TraceAxis;
}>;

export type AnalysisProvenance = Readonly<{
  source: "model" | InputMode;
  calibration: CalibrationStatus;
  method: string;
  sampleRateHz?: number;
  frameSize?: number;
  hopSize?: number;
  droppedFrames?: number;
}>;

export type TrialSnapshotV2 = Readonly<{
  id: string;
  labId: LabId;
  lessonId: string;
  protocolId: string;
  deterministic: boolean;
  seed?: string;
  recordedAt: string;
  factors: Readonly<Record<string, FactorValue>>;
  observables: readonly ObservableRecord[];
  trace: readonly TracePoint[];
  provenance: AnalysisProvenance;
  note?: string;
}>;

export type LabEvaluation = Readonly<{
  headline: string;
  result: string;
  observables: readonly ObservableRecord[];
  trace: readonly TracePoint[];
  traceAxes: TraceAxes;
  visualKind: "phase" | "pulse" | "spectrum" | "pitch" | "network" | "distribution" | "measurement";
  annotation: string;
  provenance: AnalysisProvenance;
}>;

export type LabLesson = Readonly<{
  id: string;
  labId: LabId;
  number: 1 | 2 | 3;
  level: "foundation" | "model" | "critique";
  title: string;
  shortTitle: string;
  question: string;
  objective: string;
  equation: string;
  equationCaption: string;
  predictionPrompt: string;
  experimentPrompt: string;
  interpretationPrompt: string;
  transferPrompt: string;
  factors: readonly FactorDefinition[];
  claimIds: readonly string[];
  sourceIds: readonly string[];
  protocol: Readonly<{
    id: string;
    deterministic: boolean;
    durationSeconds: number;
    seed?: string;
  }>;
  inputModes: readonly InputMode[];
}>;

export type LabDomain = Readonly<{
  id: LabId;
  number: number;
  title: string;
  shortTitle: string;
  mark: string;
  description: string;
  lessons: readonly LabLesson[];
}>;

export function defaultFactorsFor(lesson: LabLesson): Record<string, FactorValue> {
  return Object.fromEntries(lesson.factors.map((factor) => [factor.id, factor.defaultValue]));
}

export function lessonRoute(lesson: LabLesson): string {
  return `#/labs/${lesson.labId}/lessons/${lesson.id}`;
}

export function isDeterministicTrialSource(source: AnalysisProvenance["source"]): boolean {
  return source === "model" || source === "synthetic";
}
