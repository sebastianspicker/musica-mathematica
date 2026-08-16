import { evaluateLesson } from "../../labs/evaluate";
import {
  defaultFactorsFor,
  type FactorValue,
  type InputMode,
  type LabEvaluation,
  type LabLesson,
} from "../../labs/types";
import type { LessonAttemptV2 } from "../../learning/portfolio";
import type { LessonStage as BriefStage } from "./LessonBrief";

export function factorsForAttempt(lesson: LabLesson, attempt: LessonAttemptV2): Record<string, FactorValue> {
  const defaults = defaultFactorsFor(lesson);
  const latest = attempt.trials.at(-1)?.factors;
  if (!latest) return defaults;
  return Object.fromEntries(lesson.factors.map((factor) => [factor.id, latest[factor.id] ?? defaults[factor.id]]));
}

export function runLabel(runCount: number): string {
  if (runCount === 0) return "Run A";
  if (runCount === 1) return "Run B";
  return `Run ${runCount + 1}`;
}

export function seedForTrial(lesson: LabLesson, factors: Readonly<Record<string, FactorValue>>): string {
  if (lesson.protocol.seed?.startsWith("factor:")) {
    const id = lesson.protocol.seed.slice("factor:".length);
    return String(new Map(Object.entries(factors)).get(id) ?? "unspecified");
  }
  return lesson.protocol.seed ?? "unspecified";
}

export function briefStageFor(stage: LessonAttemptV2["stage"]): BriefStage {
  if (stage === "orient" || stage === "predict") return "predict";
  if (stage === "experiment") return "experiment";
  if (stage === "compare" || stage === "explain" || stage === "perform") return "interpret";
  return "transfer";
}

export function initialMotionEnabled(): boolean {
  return typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function recordingBlocker(
  attempt: LessonAttemptV2,
  inputMode: InputMode,
  audioEvaluation: LabEvaluation | null,
  lesson: LabLesson,
): string | undefined {
  if (attempt.stage !== "experiment") return "Open the experiment stage before recording a run.";
  if (inputMode !== "synthetic" && audioEvaluation === null) return "Capture or decode a bounded local segment before recording a microphone or file analysis.";
  if (inputMode !== "synthetic" && audioEvaluation?.provenance.source !== inputMode) return "Analyze a fresh bounded segment from the selected source before recording a run.";
  if (inputMode !== "synthetic" && lesson.id !== "recorded-onset-hypotheses") return "Local audio is an observation appendix in this lesson. Use the synthetic model for a controlled A/B run.";
  return undefined;
}

export function evidenceClaimIdsFor(
  lesson: LabLesson,
  evaluation: ReturnType<typeof evaluateLesson>,
): readonly string[] {
  const resultClaims = new Set(evaluation.observables.map((observable) => observable.claimId));
  const contextual = lesson.claimIds.filter((claimId) => (
    claimId !== "measurement.local" && claimId !== "hypothesis.transcription"
  ) || resultClaims.has(claimId));
  return [...new Set([...contextual, ...resultClaims])];
}
