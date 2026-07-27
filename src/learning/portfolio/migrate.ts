import { labLessonById } from "../../labs/catalog";
import type { FactorValue, LabId, ObservableRecord, TrialSnapshotV2 } from "../../labs/types";
import { isLessonAttemptV1, type LessonAttemptV1 } from "../lessonAttempt";
import { learningRecordStorageKey as legacyLearningRecordStorageKey, type LearningRecordStorage } from "../localLearningRecord";
import { createPortfolio } from "./attempt";
import {
  attemptKey,
  legacyLessonMapping,
  maximumTrialsPerLesson,
  type MigratedEnsembleLessonId,
} from "./constants";
import type { LearningPortfolioV2, LessonAttemptV2 } from "./types";
import { sanitizePortfolio } from "./validate";

export function migrateLessonAttemptV1(attempt: LessonAttemptV1, now: string): LearningPortfolioV2 {
  const lessonId = legacyLessonMapping[attempt.lessonId] ?? "lock-in-and-order";
  const labId: LabId = "ensemble-dynamics";
  const lesson = labLessonById(labId, lessonId);
  if (!lesson) return createPortfolio();
  const trials = attempt.runs.map((run, index): TrialSnapshotV2 => ({
    id: run.id || `Legacy run ${index + 1}`,
    labId,
    lessonId,
    protocolId: `${lesson.protocol.id}.legacy-v1`,
    deterministic: true,
    recordedAt: now,
    factors: legacyFactorsForLesson(run.config, lessonId),
    observables: legacyMetrics(run.metrics),
    trace: [],
    provenance: {
      source: "model",
      calibration: "uncalibrated",
      method: `Migrated from ${legacyLearningRecordStorageKey}; legacy fixed-duration ensemble trial; factors projected to ${lesson.protocol.id}`,
    },
    ...(run.note ? { note: run.note } : {}),
  })).slice(-maximumTrialsPerLesson);
  const migratedAttempt: LessonAttemptV2 = {
    version: 2,
    labId,
    lessonId,
    stage: attempt.stage,
    ...(attempt.prediction ? { prediction: attempt.prediction } : {}),
    ...(attempt.explanation ? { explanation: attempt.explanation } : {}),
    ...(attempt.performanceReflection ? { performanceReflection: attempt.performanceReflection } : {}),
    ...(attempt.transferResponse ? { transferResponse: attempt.transferResponse } : {}),
    trials,
    updatedAt: now,
  };
  return sanitizePortfolio({
    version: 2,
    active: { labId, lessonId },
    attempts: { [attemptKey(labId, lessonId)]: migratedAttempt },
  });
}

export function migrateLegacyRecord(storage: LearningRecordStorage, now: string): LearningPortfolioV2 | undefined {
  try {
    const raw = storage.getItem(legacyLearningRecordStorageKey);
    if (raw === null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!isLessonAttemptV1(parsed)) return undefined;
    return migrateLessonAttemptV1(parsed, now);
  } catch {
    return undefined;
  }
}

function legacyFactorsForLesson(
  config: LessonAttemptV1["runs"][number]["config"],
  lessonId: MigratedEnsembleLessonId,
): Record<string, FactorValue> {
  if (lessonId === "lock-in-and-order") {
    return {
      musicianCount: config.musicianCount,
      tempoBpm: config.tempoBpm,
      tempoSpreadBpm: config.tempoSpreadBpm,
      couplingStrength: config.couplingStrength,
    };
  }
  if (lessonId === "delay-jitter-topology") {
    return {
      latencyMs: config.latencySeconds * 1000,
      jitterMs: config.jitterSeconds * 1000,
      couplingStrength: config.couplingStrength,
      topology: config.topology === "click-track" ? "all-to-all" : config.topology,
    };
  }
  return {
    clickTrackStrength: config.clickTrackStrength,
    couplingStrength: config.couplingStrength,
    tempoSpreadBpm: config.tempoSpreadBpm,
    tempoBpm: config.tempoBpm,
  };
}

function legacyMetrics(metrics: LessonAttemptV1["runs"][number]["metrics"]): ObservableRecord[] {
  return [
    { id: "coherence", label: "Order parameter", value: metrics.coherence, unit: null, aggregation: "instantaneous", claimId: "model.ensemble", precision: 3 },
    { id: "phaseSpread", label: "Circular phase spread", value: metrics.phaseSpread, unit: "rad", aggregation: "instantaneous", claimId: "model.ensemble", precision: 3 },
    { id: "phaseSpreadEquivalent", label: "Period-equivalent spread", value: metrics.phaseSpreadEquivalentMs, unit: "ms", aggregation: "instantaneous", claimId: "model.ensemble", precision: 1 },
    { id: "peerShare", label: "Peer-coupling share", value: metrics.peerCouplingShare, unit: null, aggregation: "instantaneous", claimId: "heuristic.transparent", precision: 2 },
  ];
}
