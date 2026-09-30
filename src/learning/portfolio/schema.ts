import type { CurriculumDomainId, EvaluationProvenance, FactorValue, ObservableRecord, TracePoint } from "../../curriculum/contracts";
import type { LessonStage } from "../stages";

/** Exact persisted v2 JSON schema. Field names intentionally retain `labId`. */
export type TrialSnapshotV2 = Readonly<{ id: string; labId: CurriculumDomainId; lessonId: string; protocolId: string; deterministic: boolean; seed?: string; recordedAt: string; factors: Readonly<Record<string, FactorValue>>; observables: readonly ObservableRecord[]; trace: readonly TracePoint[]; provenance: EvaluationProvenance; note?: string }>;
export type LessonAttemptV2 = Readonly<{ version: 2; labId: CurriculumDomainId; lessonId: string; stage: LessonStage; prediction?: string; explanation?: string; performanceReflection?: string; transferResponse?: string; trials: readonly TrialSnapshotV2[]; updatedAt: string }>;
export type LearningPortfolioV2 = Readonly<{ version: 2; active: Readonly<{ labId: CurriculumDomainId; lessonId: string }>; attempts: Readonly<Record<string, LessonAttemptV2>> }>;
export type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const portfolioStorageKey = "musicaMathematica.learning.v2";
export const legacyPortfolioStorageKey = "ensembleCouplingLab.learning.v1";
export const maximumTrialsPerLesson = 12;
export const maximumTracePointsPerTrial = 256;
export const maximumObservablesPerTrial = 24;
export const maximumExtensionFactorsPerTrial = 16;
export const maximumResponseCodePoints = 16_384;
export const maximumLongValueCodePoints = 1_024;
export const maximumExtensionFactorCodePoints = 512;
export const maximumLabelCodePoints = 256;
export const maximumPortfolioJsonBytes = 4 * 1024 * 1024;
export const maximumRawPortfolioJsonBytes = 8 * 1024 * 1024;
export const traceCompactionTiers = [128, 64, 32, 16, 0] as const;
export const attemptKey = (labId: string, lessonId: string): string => `${labId}:${lessonId}`;
