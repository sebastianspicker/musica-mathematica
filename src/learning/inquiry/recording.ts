import { audioAnalysisFactors, defaultFactorsFor, type EvaluationOutput, type FactorValue, type InputMode, type LessonDefinition } from "../../curriculum/contracts";
import type { LessonAttemptV2 } from "../portfolio/schema";

/** Resume the latest recorded factors (or an explicit initial view), falling back to lesson defaults. */
export function factorsForAttempt(
  lesson: LessonDefinition,
  attempt: LessonAttemptV2,
  initialFactors?: Readonly<Record<string, FactorValue>>,
): Record<string, FactorValue> {
  const defaults = defaultFactorsFor(lesson);
  const latest = initialFactors ?? attempt.trials.at(-1)?.factors;
  if (!latest) return defaults;
  return Object.fromEntries(lesson.factors.map((factor) => [factor.id, latest[factor.id] ?? defaults[factor.id]]));
}

export function recordingBlocker(
  attempt: LessonAttemptV2,
  inputMode: InputMode,
  audioEvaluation: EvaluationOutput | null,
  lesson: LessonDefinition,
): string | undefined {
  if (attempt.stage !== "experiment") return "Open the experiment stage before recording a run.";
  if (inputMode !== "synthetic" && audioEvaluation === null) return "Capture or decode a bounded local segment before recording a microphone or file analysis.";
  if (inputMode !== "synthetic" && audioEvaluation?.provenance.source !== inputMode) return "Analyze a fresh bounded segment from the selected source before recording a run.";
  if (inputMode !== "synthetic" && audioAnalysisFactors(lesson).length === 0) return "Local audio is an observation appendix in this lesson. Use the synthetic model for a controlled A/B run.";
  return undefined;
}
