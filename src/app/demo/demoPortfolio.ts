import type {
  EvaluationOutput,
  FactorValue,
  LessonDefinition,
} from "../../curriculum/contracts";
import type { CurriculumRegistry } from "../../curriculum/registry";
import { attemptKey } from "../../learning/portfolio/constants";
import type {
  LearningPortfolioV2,
  LessonAttemptV2,
  TrialSnapshotV2,
} from "../../learning/portfolio/schema-v2";

const demoDomainId = "phase-proportion";
const demoLessonId = "from-bpm-to-period";
const demoUpdatedAt = "2026-09-01T12:02:00.000Z";

/** A real, schema-valid comparison assembled from the production evaluator. */
export function createDemoPortfolio(curriculum: CurriculumRegistry): LearningPortfolioV2 {
  const lesson = curriculum.lessonById(demoDomainId, demoLessonId);
  if (!lesson) throw new RangeError("The Pages demo lesson is missing from the curriculum.");

  const runA = createDemoTrial(curriculum, lesson, "Run A", {
    bpm: 90,
    beatsPerBar: 4,
  }, "2026-09-01T12:00:00.000Z", "Baseline at the score tempo.");
  const runB = createDemoTrial(curriculum, lesson, "Run B", {
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
  id: string,
  factors: Readonly<Record<string, FactorValue>>,
  recordedAt: string,
  note: string,
): TrialSnapshotV2 {
  const evaluation = curriculum.evaluatorFor(lesson.domainId, lesson.id)(factors);
  return {
    id,
    labId: lesson.domainId,
    lessonId: lesson.id,
    protocolId: lesson.protocol.id,
    deterministic: isDeterministic(lesson, evaluation),
    recordedAt,
    factors: { ...factors },
    observables: evaluation.observables.map((observable) => ({ ...observable })),
    trace: evaluation.trace.map((point) => ({ ...point })),
    provenance: { ...evaluation.provenance },
    note,
  };
}

function isDeterministic(lesson: LessonDefinition, evaluation: EvaluationOutput): boolean {
  return lesson.protocol.deterministic
    && (evaluation.provenance.source === "model" || evaluation.provenance.source === "synthetic");
}
