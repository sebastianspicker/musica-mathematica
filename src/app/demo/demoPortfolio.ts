import type { FactorValue, LessonDefinition } from "../../curriculum/contracts";
import type { CurriculumRegistry } from "../../curriculum/registry";
import { createTrialSnapshot } from "../../learning/portfolio/aggregate";
import {
  attemptKey,
  type LearningPortfolioV2,
  type LessonAttemptV2,
  type TrialSnapshotV2,
} from "../../learning/portfolio/schema";

const demoDomainId = "phase-proportion";
const demoLessonId = "from-bpm-to-period";
const demoUpdatedAt = "2026-09-01T12:02:00.000Z";

/** A real, schema-valid comparison assembled from the production evaluator. */
export function createDemoPortfolio(curriculum: CurriculumRegistry): LearningPortfolioV2 {
  const lesson = curriculum.lessonById(demoDomainId, demoLessonId);
  if (!lesson) throw new RangeError("The Pages demo lesson is missing from the curriculum.");

  const runA = createDemoTrial(curriculum, lesson, 0, {
    bpm: 90,
    beatsPerBar: 4,
  }, "2026-09-01T12:00:00.000Z", "Baseline at the score tempo.");
  const runB = createDemoTrial(curriculum, lesson, 1, {
    bpm: 120,
    beatsPerBar: 4,
  }, "2026-09-01T12:01:00.000Z", "Only tempo changed; beats per bar stayed at four.");
  const attempt: LessonAttemptV2 = {
    version: 2,
    labId: lesson.domainId,
    lessonId: lesson.id,
    stage: "compare",
    prediction: "At 120 BPM, the beat period will fall from about 0.667 s to 0.500 s because period is inversely proportional to tempo.",
    trials: [runA, runB],
    updatedAt: demoUpdatedAt,
  };

  return {
    version: 2,
    active: { labId: lesson.domainId, lessonId: lesson.id },
    attempts: { [attemptKey(lesson.domainId, lesson.id)]: attempt },
  };
}

function createDemoTrial(
  curriculum: CurriculumRegistry,
  lesson: LessonDefinition,
  runIndex: number,
  factors: Readonly<Record<string, FactorValue>>,
  recordedAt: string,
  note: string,
): TrialSnapshotV2 {
  const evaluation = curriculum.evaluatorFor(lesson.domainId, lesson.id)(factors);
  return createTrialSnapshot({ lesson, runIndex, factors, evaluation, note, recordedAt });
}
