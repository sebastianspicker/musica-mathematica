import type {
  CurriculumLessonReader,
  FactorValue,
  ObservableRecord,
} from "../../../curriculum/contracts";
import {
  attemptKey,
  legacyPortfolioStorageKey,
  maximumTrialsPerLesson,
  type LearningPortfolioV2,
  type LessonAttemptV2,
  type TrialSnapshotV2,
} from "../schema";
import { createPortfolio } from "../aggregate";
import { sanitizePortfolio } from "../validate";
import { type LessonAttemptV1 } from "./schema";
import { isLessonAttemptV1 } from "./validate";

export const legacyLessonMapping = Object.freeze({ "lock-in": "lock-in-and-order", latency: "delay-jitter-topology", "low-latency-route": "delay-jitter-topology", "diagnose-instability": "delay-jitter-topology", click: "external-pulse-or-peer-adaptation", "click-or-peer-coupling": "external-pulse-or-peer-adaptation", "compose-with-latency": "external-pulse-or-peer-adaptation" } as const);
type MigratedEnsembleLessonId = (typeof legacyLessonMapping)[keyof typeof legacyLessonMapping];

const migratedDomainId = "ensemble-dynamics" as const;

export function migrateLessonAttemptV1(
  attempt: LessonAttemptV1,
  curriculum: CurriculumLessonReader,
  now: string,
): LearningPortfolioV2 {
  const lessonId = migratedLessonId(attempt.lessonId);
  const lesson = curriculum.lessonById(migratedDomainId, lessonId);
  if (!lesson) return createPortfolio(curriculum);

  const trials = attempt.runs
    .map((run, index) => migrateRun(run, lessonId, lesson.protocol.id, now, index))
    .slice(-maximumTrialsPerLesson);
  const migratedAttempt = migratedAttemptFor(attempt, lessonId, trials, now);
  return sanitizePortfolio({
    version: 2,
    active: { labId: migratedDomainId, lessonId },
    attempts: { [attemptKey(migratedDomainId, lessonId)]: migratedAttempt },
  }, curriculum);
}

export function migrateLegacyJson(
  raw: string,
  curriculum: CurriculumLessonReader,
  now: string,
): LearningPortfolioV2 | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isLessonAttemptV1(parsed)
      ? migrateLessonAttemptV1(parsed, curriculum, now)
      : undefined;
  } catch {
    return undefined;
  }
}

function migratedLessonId(legacyLessonId: string): MigratedEnsembleLessonId {
  return legacyLessonMapping[legacyLessonId as keyof typeof legacyLessonMapping]
    ?? "lock-in-and-order";
}

function migrateRun(
  run: LessonAttemptV1["runs"][number],
  lessonId: MigratedEnsembleLessonId,
  protocolId: string,
  now: string,
  index: number,
): TrialSnapshotV2 {
  return {
    id: run.id || `Legacy run ${index + 1}`,
    labId: migratedDomainId,
    lessonId,
    protocolId: `${protocolId}.legacy-v1`,
    deterministic: true,
    recordedAt: now,
    factors: legacyFactorsForLesson(run.config, lessonId),
    observables: legacyMetrics(run.metrics),
    trace: [],
    provenance: {
      source: "model",
      calibration: "uncalibrated",
      method: `Migrated from ${legacyPortfolioStorageKey}; legacy fixed-duration ensemble trial; factors projected to ${protocolId}`,
    },
    ...(run.note ? { note: run.note } : {}),
  };
}

function migratedAttemptFor(
  attempt: LessonAttemptV1,
  lessonId: MigratedEnsembleLessonId,
  trials: readonly TrialSnapshotV2[],
  now: string,
): LessonAttemptV2 {
  return {
    version: 2,
    labId: migratedDomainId,
    lessonId,
    stage: attempt.stage,
    ...(attempt.prediction ? { prediction: attempt.prediction } : {}),
    ...(attempt.explanation ? { explanation: attempt.explanation } : {}),
    ...(attempt.performanceReflection ? { performanceReflection: attempt.performanceReflection } : {}),
    ...(attempt.transferResponse ? { transferResponse: attempt.transferResponse } : {}),
    trials,
    updatedAt: now,
  };
}

function legacyFactorsForLesson(
  config: LessonAttemptV1["runs"][number]["config"],
  lessonId: MigratedEnsembleLessonId,
): Record<string, FactorValue> {
  switch (lessonId) {
    case "lock-in-and-order":
      return {
        musicianCount: config.musicianCount,
        tempoBpm: config.tempoBpm,
        tempoSpreadBpm: config.tempoSpreadBpm,
        couplingStrength: config.couplingStrength,
      };
    case "delay-jitter-topology":
      return {
        latencyMs: config.latencySeconds * 1000,
        jitterMs: config.jitterSeconds * 1000,
        couplingStrength: config.couplingStrength,
        topology: config.topology === "click-track" ? "all-to-all" : config.topology,
      };
    case "external-pulse-or-peer-adaptation":
      return {
        clickTrackStrength: config.clickTrackStrength,
        couplingStrength: config.couplingStrength,
        tempoSpreadBpm: config.tempoSpreadBpm,
        tempoBpm: config.tempoBpm,
      };
  }
}

function legacyMetrics(
  metrics: LessonAttemptV1["runs"][number]["metrics"],
): ObservableRecord[] {
  return [
    { id: "coherence", label: "Order parameter", value: metrics.coherence, unit: null, aggregation: "instantaneous", claimId: "model.ensemble", precision: 3 },
    { id: "phaseSpread", label: "Circular phase spread", value: metrics.phaseSpread, unit: "rad", aggregation: "instantaneous", claimId: "model.ensemble", precision: 3 },
    { id: "phaseSpreadEquivalent", label: "Period-equivalent spread", value: metrics.phaseSpreadEquivalentMs, unit: "ms", aggregation: "instantaneous", claimId: "model.ensemble", precision: 1 },
    { id: "peerShare", label: "Peer-coupling share", value: metrics.peerCouplingShare, unit: null, aggregation: "instantaneous", claimId: "heuristic.transparent", precision: 2 },
  ];
}
