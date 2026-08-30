import type { LessonStage } from "../stages";

/**
 * Historical persisted DTO. It deliberately describes the former ensemble
 * record itself and never imports the active ensemble implementation.
 */
export type LegacyEnsembleConfig = Readonly<{
  musicianCount: number;
  tempoBpm: number;
  tempoSpreadBpm: number;
  couplingStrength: number;
  latencySeconds: number;
  jitterSeconds: number;
  topology: "all-to-all" | "leader-follower" | "sections" | "click-track";
  repertoireTexture: "pulse" | "dense-rhythm" | "call-response" | "drone" | "rubato";
  clickTrackStrength: number;
}>;

export type LegacyEnsembleMetrics = Readonly<{
  coherence: number;
  phaseSpread: number;
  phaseSpreadEquivalentMs: number;
  peerCouplingShare: number;
  modelLatencyBudgetSeconds: number;
  leaderToFollowerPhaseLagMs: number | null;
  sectionCoherences: readonly number[] | null;
}>;

export type LegacyRunSnapshot = Readonly<{
  id: string;
  durationSeconds: number;
  config: LegacyEnsembleConfig;
  metrics: LegacyEnsembleMetrics;
  note?: string;
}>;

export type LessonAttemptV1 = Readonly<{
  version: 1;
  lessonId: string;
  stage: LessonStage;
  prediction?: string;
  explanation?: string;
  performanceReflection?: string;
  transferResponse?: string;
  runs: readonly LegacyRunSnapshot[];
}>;

export type LearningRecordStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
