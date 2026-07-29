import {
  ensembleConfigBounds,
  type EnsembleConfig,
  type EnsembleMetrics,
  type RepertoireTexture,
  type Topology,
} from "../simulation/ensemble";

export const lessonStages = [
  "orient",
  "predict",
  "experiment",
  "compare",
  "explain",
  "perform",
  "transfer",
  "debrief",
] as const;

export type LessonStage = (typeof lessonStages)[number];
export type EvidenceStatus = "model-based" | "classroom-observation" | "external-source";

export type RunSnapshot = {
  id: string;
  durationSeconds: number;
  config: EnsembleConfig;
  metrics: EnsembleMetrics;
  note?: string;
};

export type LessonAttemptV1 = {
  version: 1;
  lessonId: string;
  stage: LessonStage;
  prediction?: string;
  explanation?: string;
  performanceReflection?: string;
  transferResponse?: string;
  runs: RunSnapshot[];
};

export type LessonResponseField = "explanation" | "performanceReflection" | "transferResponse";

export type LessonAttemptEvent =
  | { type: "advance"; stage: Exclude<LessonStage, "orient"> }
  | { type: "set-prediction"; prediction: string }
  | { type: "set-response"; field: LessonResponseField; response: string }
  | { type: "record-run"; run: RunSnapshot };

export type LessonAttemptTransition =
  | { ok: true; attempt: LessonAttemptV1 }
  | { ok: false; reason: string; attempt: LessonAttemptV1 };

const stageIndex = (stage: LessonStage): number => lessonStages.indexOf(stage);
const minimumRunsFailure = (attempt: LessonAttemptV1): string | undefined => {
  return attempt.runs.length >= 2 ? undefined : "Record at least two runs before comparing or explaining.";
};
const responseStages: Readonly<Record<LessonResponseField, LessonStage>> = {
  explanation: "explain",
  performanceReflection: "perform",
  transferResponse: "transfer",
};
const stageRequirementFailures: Partial<Record<LessonStage, (attempt: LessonAttemptV1) => string | undefined>> = {
  experiment: (attempt) => hasPrediction(attempt) ? undefined : "Record a prediction before beginning an experiment.",
  compare: minimumRunsFailure,
  explain: minimumRunsFailure,
  perform: (attempt) => hasResponse(attempt.explanation) ? undefined : "Record an explanation before performing.",
  transfer: (attempt) => hasResponse(attempt.performanceReflection) ? undefined : "Record a performance reflection before transfer.",
  debrief: (attempt) => hasResponse(attempt.transferResponse) ? undefined : "Record a transfer response before debriefing.",
};

export function createLessonAttempt(lessonId: string): LessonAttemptV1 {
  if (lessonId.trim().length === 0) {
    throw new Error("A lesson attempt needs a lesson ID.");
  }

  return { version: 1, lessonId, stage: "orient", runs: [] };
}

/**
 * Applies one UI-independent inquiry event. It never mutates the supplied
 * record, so a caller can retain a reliable local history of decisions.
 */
export function transitionLessonAttempt(
  attempt: LessonAttemptV1,
  event: LessonAttemptEvent,
): LessonAttemptTransition {
  if (!isLessonAttemptV1(attempt)) {
    return rejected(attempt, "The lesson attempt is invalid.");
  }

  if (event.type === "set-prediction") return setPrediction(attempt, event.prediction);
  if (event.type === "record-run") return appendRun(attempt, event.run);
  if (event.type === "set-response") return setResponse(attempt, event.field, event.response);
  return advanceStage(attempt, event.stage);
}

const setPrediction = (attempt: LessonAttemptV1, predictionInput: string): LessonAttemptTransition => {
  const prediction = predictionInput.trim();
  if (prediction.length === 0) return rejected(attempt, "A prediction must contain text.");
  if (stageIndex(attempt.stage) >= stageIndex("experiment")) {
    return rejected(attempt, "Predictions cannot change after the experiment begins.");
  }
  return accepted({ ...attempt, stage: "predict", prediction });
};

const appendRun = (attempt: LessonAttemptV1, run: RunSnapshot): LessonAttemptTransition => {
  if (stageIndex(attempt.stage) < stageIndex("experiment") || !hasPrediction(attempt)) {
    return rejected(attempt, "Record a prediction before running an experiment.");
  }
  if (!isRunSnapshot(run)) return rejected(attempt, "The run snapshot is invalid.");
  return accepted({ ...attempt, runs: [...attempt.runs, cloneRun(run)] });
};

const setResponse = (
  attempt: LessonAttemptV1,
  field: LessonResponseField,
  responseInput: string,
): LessonAttemptTransition => {
  const response = responseInput.trim();
  if (response.length === 0) return rejected(attempt, "A lesson response must contain text.");
  if (attempt.stage !== responseStages[field]) {
    return rejected(attempt, "This response can only be recorded in its inquiry stage.");
  }
  return accepted({ ...attempt, [field]: response });
};

const advanceStage = (attempt: LessonAttemptV1, stage: Exclude<LessonStage, "orient">): LessonAttemptTransition => {
  if (stage !== lessonStages[stageIndex(attempt.stage) + 1]) {
    return rejected(attempt, "Inquiry stages must be completed in order.");
  }
  const reason = unmetStageRequirement(attempt, stage);
  return reason ? rejected(attempt, reason) : accepted({ ...attempt, stage });
};

const unmetStageRequirement = (attempt: LessonAttemptV1, stage: LessonStage): string | undefined => {
  return stageRequirementFailures[stage]?.(attempt);
};

const accepted = (attempt: LessonAttemptV1): LessonAttemptTransition => {
  return { ok: true, attempt };
};

const rejected = (attempt: LessonAttemptV1, reason: string): LessonAttemptTransition => {
  return { ok: false, reason, attempt };
};

const isLessonAttemptV1Shape = (value: unknown): value is LessonAttemptV1 => {
  if (!isRecord(value)) return false;
  return hasAttemptMetadata(value) && hasAttemptRuns(value) && hasAttemptResponses(value);
};

const hasAttemptMetadata = (value: Record<string, unknown>): boolean => {
  return value.version === 1 && typeof value.lessonId === "string" && value.lessonId.trim().length > 0 && isLessonStage(value.stage);
};

const hasAttemptRuns = (value: Record<string, unknown>): boolean => {
  return Array.isArray(value.runs) && value.runs.every(isRunSnapshot);
};

const hasAttemptResponses = (value: Record<string, unknown>): boolean => {
  return [value.prediction, value.explanation, value.performanceReflection, value.transferResponse].every(isOptionalResponse);
};

const hasConsistentStageState = (attempt: LessonAttemptV1): boolean => {
  const currentStageIndex = stageIndex(attempt.stage);
  return hasConsistentPrediction(attempt, currentStageIndex)
    && hasConsistentRuns(attempt, currentStageIndex)
    && hasConsistentExplanation(attempt, currentStageIndex)
    && hasConsistentPerformanceReflection(attempt, currentStageIndex)
    && hasConsistentTransferResponse(attempt, currentStageIndex);
};

const hasConsistentPrediction = (attempt: LessonAttemptV1, currentStageIndex: number): boolean => {
  if (currentStageIndex === stageIndex("orient")) return attempt.prediction === undefined;
  return currentStageIndex < stageIndex("experiment") || hasResponse(attempt.prediction);
};

const hasConsistentRuns = (attempt: LessonAttemptV1, currentStageIndex: number): boolean => {
  if (attempt.runs.length > 0 && currentStageIndex < stageIndex("experiment")) return false;
  return currentStageIndex < stageIndex("compare") || attempt.runs.length >= 2;
};

const hasConsistentExplanation = (attempt: LessonAttemptV1, currentStageIndex: number): boolean => {
  if (currentStageIndex < stageIndex("explain")) return attempt.explanation === undefined;
  return currentStageIndex < stageIndex("perform") || hasResponse(attempt.explanation);
};

const hasConsistentPerformanceReflection = (attempt: LessonAttemptV1, currentStageIndex: number): boolean => {
  if (currentStageIndex < stageIndex("perform")) return attempt.performanceReflection === undefined;
  return currentStageIndex < stageIndex("transfer") || hasResponse(attempt.performanceReflection);
};

const hasConsistentTransferResponse = (attempt: LessonAttemptV1, currentStageIndex: number): boolean => {
  if (currentStageIndex < stageIndex("transfer")) return attempt.transferResponse === undefined;
  return currentStageIndex < stageIndex("debrief") || hasResponse(attempt.transferResponse);
};

const hasPrediction = (attempt: LessonAttemptV1): boolean => {
  return hasResponse(attempt.prediction);
};

const hasResponse = (response: string | undefined): boolean => {
  return response?.trim().length !== 0 && response !== undefined;
};

export const isLessonStage = (value: unknown): value is LessonStage => {
  return typeof value === "string" && (lessonStages as readonly string[]).includes(value);
};

const isRunSnapshot = (value: unknown): value is RunSnapshot => {
  if (!isRecord(value) || !hasRunSnapshotDetails(value)) return false;
  return isEnsembleMetrics(value.metrics, value.config);
};

const hasRunSnapshotDetails = (value: Record<string, unknown>): value is Record<string, unknown> & { config: EnsembleConfig } => {
  return hasNonEmptyText(value.id)
    && isPositiveFiniteNumber(value.durationSeconds)
    && isEnsembleConfig(value.config)
    && (value.note === undefined || typeof value.note === "string");
};

const isEnsembleConfig = (value: unknown): value is EnsembleConfig => {
  if (!isRecord(value)) return false;
  return hasBoundedEnsembleConfigNumbers(value)
    && isTopology(value.topology)
    && isRepertoireTexture(value.repertoireTexture);
};

const hasBoundedEnsembleConfigNumbers = (value: Record<string, unknown>): boolean => {
  return numberWithinBounds(value.musicianCount, ensembleConfigBounds.musicianCount)
    && Number.isInteger(value.musicianCount)
    && numberWithinBounds(value.tempoBpm, ensembleConfigBounds.tempoBpm)
    && numberWithinBounds(value.tempoSpreadBpm, ensembleConfigBounds.tempoSpreadBpm)
    && numberWithinBounds(value.couplingStrength, ensembleConfigBounds.couplingStrength)
    && numberWithinBounds(value.latencySeconds, ensembleConfigBounds.latencySeconds)
    && numberWithinBounds(value.jitterSeconds, ensembleConfigBounds.jitterSeconds)
    && numberWithinBounds(value.clickTrackStrength, ensembleConfigBounds.clickTrackStrength);
};

const isEnsembleMetrics = (value: unknown, config: EnsembleConfig): value is EnsembleMetrics => {
  if (!isRecord(value)) return false;
  return hasCoreEnsembleMetrics(value)
    && hasValidLeaderLag(value, config)
    && hasValidSectionCoherences(value, config);
};

const hasCoreEnsembleMetrics = (value: Record<string, unknown>): boolean => {
  return numberInRange(value.coherence, 0, 1)
    && numberInRange(value.phaseSpread, 0, Math.PI)
    && isFiniteNumber(value.phaseSpreadEquivalentMs)
    && value.phaseSpreadEquivalentMs >= 0
    && numberInRange(value.peerCouplingShare, 0, 1)
    && isFiniteNumber(value.modelLatencyBudgetSeconds)
    && value.modelLatencyBudgetSeconds > 0;
};

const hasValidLeaderLag = (value: Record<string, unknown>, config: EnsembleConfig): boolean => {
  return config.topology === "leader-follower"
    ? isFiniteNumber(value.leaderToFollowerPhaseLagMs)
    : value.leaderToFollowerPhaseLagMs === null;
};

const hasValidSectionCoherences = (value: Record<string, unknown>, config: EnsembleConfig): boolean => {
  if (config.topology !== "sections") return value.sectionCoherences === null;
  return Array.isArray(value.sectionCoherences)
    && value.sectionCoherences.length === Math.ceil(config.musicianCount / 2)
    && value.sectionCoherences.every((coherence) => numberInRange(coherence, 0, 1));
};

const cloneRun = (run: RunSnapshot): RunSnapshot => {
  return {
    ...run,
    config: { ...run.config },
    metrics: {
      ...run.metrics,
      sectionCoherences: run.metrics.sectionCoherences === null
        ? null
        : [...run.metrics.sectionCoherences],
    },
  };
};

const isOptionalResponse = (value: unknown): value is string | undefined => {
  return value === undefined || (typeof value === "string" && value.trim().length > 0);
};

const hasNonEmptyText = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const isPositiveFiniteNumber = (value: unknown): value is number => {
  return isFiniteNumber(value) && value > 0;
};

const numberWithinBounds = (
  value: unknown,
  bounds: { min: number; max: number },
): value is number => {
  return isFiniteNumber(value) && value >= bounds.min && value <= bounds.max;
};

const numberInRange = (value: unknown, min: number, max: number): value is number => {
  return isFiniteNumber(value) && value >= min && value <= max;
};

const isTopology = (value: unknown): value is Topology => {
  return value === "all-to-all" || value === "leader-follower" || value === "sections" || value === "click-track";
};

const isRepertoireTexture = (value: unknown): value is RepertoireTexture => {
  return value === "pulse" || value === "drone" || value === "call-response" || value === "rubato" || value === "dense-rhythm";
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

export function isLessonAttemptV1(value: unknown): value is LessonAttemptV1 {
  return isLessonAttemptV1Shape(value) && hasConsistentStageState(value);
}
