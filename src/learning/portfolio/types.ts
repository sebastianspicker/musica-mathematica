import type { LabId, TrialSnapshotV2 } from "../../labs/types";
import type { LessonStage } from "../lessonAttempt";

export type LessonAttemptV2 = Readonly<{
  version: 2;
  labId: LabId;
  lessonId: string;
  stage: LessonStage;
  prediction?: string;
  explanation?: string;
  performanceReflection?: string;
  transferResponse?: string;
  trials: readonly TrialSnapshotV2[];
  updatedAt: string;
}>;

export type LearningPortfolioV2 = Readonly<{
  version: 2;
  active: Readonly<{ labId: LabId; lessonId: string }>;
  attempts: Readonly<Record<string, LessonAttemptV2>>;
}>;
