import type { FactorDefinition, FactorValue } from "../../curriculum/contracts";
import type { TrialSnapshotV2 } from "../portfolio/schema-v2";

export type TrialComparisonAssessment = Readonly<{ valid: boolean; changedFactorIds: readonly string[]; reason: string }>;

/** UI-independent controlled A/B comparison rules. */
type ComparisonLesson = Readonly<{ id: string; factors: readonly FactorDefinition[] }>;
export function assessTrialComparison(lesson: ComparisonLesson, trials: readonly TrialSnapshotV2[]): TrialComparisonAssessment {
  const left = trials.at(-2);
  const right = trials.at(-1);
  if (!left || !right) return { valid: false, changedFactorIds: [], reason: "Record two runs before comparing them." };
  if (left.lessonId !== lesson.id || right.lessonId !== lesson.id) return failure("Both runs must belong to this lesson.");
  if (left.protocolId !== right.protocolId) return failure("Both runs must use the same lesson protocol. Record two runs with the current protocol.");
  if (left.provenance.source !== right.provenance.source) return failure("Both runs must use the same analysis source.");
  if (!settingsEqual(left, right)) return failure("Hold sample rate, frame size, and hop size constant before comparing audio runs.");
  const changedFactorIds = lesson.factors.map((factor) => factor.id)
    .filter((id) => !valuesEqual(left.factors[id], right.factors[id]));
  if (changedFactorIds.length === 0) return { valid: false, changedFactorIds, reason: "Change one experimental factor before recording Run B." };
  if (changedFactorIds.length > 1) {
    const labels = changedFactorIds.map((id) => lesson.factors.find((factor) => factor.id === id)?.label ?? id);
    return { valid: false, changedFactorIds, reason: `For a controlled comparison, change one factor only. Changed: ${labels.join(", ")}.` };
  }
  if (isRecorded(left) && lesson.id !== "recorded-onset-hypotheses") return { valid: false, changedFactorIds, reason: "Local audio is an observation appendix in this lesson; use the synthetic model for a controlled A/B comparison." };
  if (isRecorded(left) && !["threshold", "meterBias"].includes(changedFactorIds[0])) return { valid: false, changedFactorIds, reason: "For recorded-onset audio, compare a fresh analysis after changing only Onset threshold or Candidate family." };
  const label = lesson.factors.find((factor) => factor.id === changedFactorIds[0])?.label ?? changedFactorIds[0];
  return { valid: true, changedFactorIds, reason: `Controlled comparison ready: only ${label} changed.` };
}

const failure = (reason: string): TrialComparisonAssessment => ({ valid: false, changedFactorIds: [], reason });
const isRecorded = (trial: TrialSnapshotV2): boolean => trial.provenance.source === "microphone" || trial.provenance.source === "file";
const settingsEqual = (left: TrialSnapshotV2, right: TrialSnapshotV2): boolean => left.provenance.sampleRateHz === right.provenance.sampleRateHz && left.provenance.frameSize === right.provenance.frameSize && left.provenance.hopSize === right.provenance.hopSize;
const valuesEqual = (left: FactorValue | undefined, right: FactorValue | undefined): boolean => typeof left === "number" && typeof right === "number" ? Math.abs(left - right) < 1e-9 : left === right;
