import type { CurriculumDomainId, EvaluationProvenance, FactorValue, ObservableRecord, TracePoint } from "../../curriculum/contracts";
import type { LessonStage } from "../stages";

/** Exact persisted v2 JSON schema. Field names intentionally retain `labId`. */
export type TrialSnapshotV2 = Readonly<{ id: string; labId: CurriculumDomainId; lessonId: string; protocolId: string; deterministic: boolean; seed?: string; recordedAt: string; factors: Readonly<Record<string, FactorValue>>; observables: readonly ObservableRecord[]; trace: readonly TracePoint[]; provenance: EvaluationProvenance; note?: string }>;
export type LessonAttemptV2 = Readonly<{ version: 2; labId: CurriculumDomainId; lessonId: string; stage: LessonStage; prediction?: string; explanation?: string; performanceReflection?: string; transferResponse?: string; trials: readonly TrialSnapshotV2[]; updatedAt: string }>;
export type LearningPortfolioV2 = Readonly<{ version: 2; active: Readonly<{ labId: CurriculumDomainId; lessonId: string }>; attempts: Readonly<Record<string, LessonAttemptV2>> }>;
