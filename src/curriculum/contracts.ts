/**
 * Curriculum definitions deliberately describe learning content and its
 * evaluator boundary only. Routes and persisted portfolio records belong to
 * their respective application boundaries.
 */
export type FactorValue = string | number | boolean;

export type CurriculumDomainId =
  | "phase-proportion"
  | "ensemble-dynamics"
  | "rhythm-meter"
  | "pitch-tuning"
  | "harmony-geometry"
  | "timbre-acoustics"
  | "probability-form"
  | "measurement-inference";

export type InputMode = "synthetic" | "microphone" | "file";

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

export type TraceAxes = Readonly<{
  x: Readonly<{ label: string; unit: string | null }>;
  y: Readonly<{ label: string; unit: string | null }>;
}>;

export type EvaluationProvenance = Readonly<{
  source: "model" | InputMode;
  calibration: "uncalibrated";
  method: string;
  sampleRateHz?: number;
  frameSize?: number;
  hopSize?: number;
  droppedFrames?: number;
}>;

export type EvaluationOutput = Readonly<{
  headline: string;
  result: string;
  observables: readonly ObservableRecord[];
  trace: readonly TracePoint[];
  traceAxes: TraceAxes;
  visualKind: "phase" | "pulse" | "spectrum" | "pitch" | "network" | "distribution" | "measurement";
  annotation: string;
  provenance: EvaluationProvenance;
}>;

export type LessonDefinition = Readonly<{
  id: string;
  domainId: CurriculumDomainId;
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

/** Minimal curriculum dependency required by learning records. */
export type CurriculumLessonReader = Readonly<{
  defaultLesson: LessonDefinition;
  lessonById: (domainId: string, lessonId: string) => LessonDefinition | undefined;
}>;

export type ThreeLessons = readonly [LessonDefinition, LessonDefinition, LessonDefinition];

export type DomainDefinition<Lessons extends ThreeLessons = ThreeLessons> = Readonly<{
  id: CurriculumDomainId;
  number: number;
  title: string;
  shortTitle: string;
  mark: string;
  description: string;
  lessons: Lessons;
}>;

export type LessonEvaluator = (
  factors: Readonly<Record<string, FactorValue>>,
) => EvaluationOutput;

export type LessonEvaluatorMap<Lessons extends ThreeLessons> = Readonly<{
  [LessonId in Lessons[number]["id"]]: LessonEvaluator;
}>;

export type DefinedDomain<Lessons extends ThreeLessons = ThreeLessons> = Readonly<{
  definition: DomainDefinition<Lessons>;
  evaluators: LessonEvaluatorMap<Lessons>;
}>;

export function defaultFactorsFor(lesson: LessonDefinition): Record<string, FactorValue> {
  return Object.fromEntries(lesson.factors.map((factor) => [factor.id, factor.defaultValue]));
}

export function isEvaluationOutput(value: unknown): value is EvaluationOutput {
  if (!isRecord(value)
    || typeof value.headline !== "string"
    || typeof value.result !== "string"
    || !Array.isArray(value.observables)
    || !Array.isArray(value.trace)
    || !isTraceAxes(value.traceAxes)
    || !isVisualKind(value.visualKind)
    || typeof value.annotation !== "string") return false;
  return value.observables.every(isObservableRecord)
    && value.trace.every(isTracePoint)
    && isProvenance(value.provenance);
}

export function assertEvaluationOutput(value: unknown): asserts value is EvaluationOutput {
  if (!isEvaluationOutput(value)) {
    throw new TypeError("Evaluator must return a finite EvaluationOutput.");
  }
}

function isObservableRecord(value: unknown): value is ObservableRecord {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.label === "string"
    && (typeof value.value === "string" || (typeof value.value === "number" && Number.isFinite(value.value)))
    && (typeof value.unit === "string" || value.unit === null)
    && isAggregation(value.aggregation)
    && typeof value.claimId === "string"
    && (value.precision === undefined || (typeof value.precision === "number"
      && Number.isInteger(value.precision) && value.precision >= 0 && value.precision <= 100));
}

function isAggregation(value: unknown): value is ObservableRecord["aggregation"] {
  return value === "instantaneous" || value === "terminal-mean" || value === "range" || value === "distribution";
}

function isTracePoint(value: unknown): value is TracePoint {
  return isRecord(value)
    && typeof value.x === "number" && Number.isFinite(value.x)
    && typeof value.y === "number" && Number.isFinite(value.y)
    && typeof value.series === "string";
}

function isTraceAxes(value: unknown): value is TraceAxes {
  return isRecord(value) && isTraceAxis(value.x) && isTraceAxis(value.y);
}

function isTraceAxis(value: unknown): boolean {
  return isRecord(value) && typeof value.label === "string" && (typeof value.unit === "string" || value.unit === null);
}

function isVisualKind(value: unknown): value is EvaluationOutput["visualKind"] {
  return value === "phase" || value === "pulse" || value === "spectrum" || value === "pitch"
    || value === "network" || value === "distribution" || value === "measurement";
}

function isProvenance(value: unknown): value is EvaluationProvenance {
  return isRecord(value)
    && (value.source === "model" || value.source === "synthetic" || value.source === "microphone" || value.source === "file")
    && value.calibration === "uncalibrated"
    && typeof value.method === "string"
    && optionalFiniteNumber(value.sampleRateHz)
    && optionalFiniteNumber(value.frameSize)
    && optionalFiniteNumber(value.hopSize)
    && optionalFiniteNumber(value.droppedFrames);
}

function optionalFiniteNumber(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
