import { audioAnalysisFactors, type FactorDefinition, type FactorValue } from "../../curriculum/contracts";
import type { TrialSnapshotV2 } from "../portfolio/schema";

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
  const changedIds = changedFactorIds(lesson.factors.map((factor) => factor.id), left.factors, right.factors);
  if (changedIds.length === 0) return { valid: false, changedFactorIds: changedIds, reason: "Change one experimental factor before recording Run B." };
  if (changedIds.length > 1) {
    const labels = changedIds.map((id) => lesson.factors.find((factor) => factor.id === id)?.label ?? id);
    return { valid: false, changedFactorIds: changedIds, reason: `For a controlled comparison, change one factor only. Changed: ${labels.join(", ")}.` };
  }
  const audioFactors = audioAnalysisFactors(lesson);
  if (isRecorded(left) && audioFactors.length === 0) return { valid: false, changedFactorIds: changedIds, reason: "Local audio is an observation appendix in this lesson; use the synthetic model for a controlled A/B comparison." };
  if (isRecorded(left) && !audioFactors.some((factor) => factor.id === changedIds[0])) return { valid: false, changedFactorIds: changedIds, reason: `For recorded audio, compare a fresh analysis after changing only ${audioFactors.map((factor) => factor.label).join(" or ")}.` };
  const label = lesson.factors.find((factor) => factor.id === changedIds[0])?.label ?? changedIds[0];
  return { valid: true, changedFactorIds: changedIds, reason: `Controlled comparison ready: only ${label} changed.` };
}

const failure = (reason: string): TrialComparisonAssessment => ({ valid: false, changedFactorIds: [], reason });
const isRecorded = (trial: TrialSnapshotV2): boolean => trial.provenance.source === "microphone" || trial.provenance.source === "file";
const settingsEqual = (left: TrialSnapshotV2, right: TrialSnapshotV2): boolean => left.provenance.sampleRateHz === right.provenance.sampleRateHz && left.provenance.frameSize === right.provenance.frameSize && left.provenance.hopSize === right.provenance.hopSize;
/** Ids among `factorIds` whose value differs between two trials (numbers compare within 1e-9). */
export function changedFactorIds(factorIds: readonly string[], leftFactors: Readonly<Record<string, FactorValue>>, rightFactors: Readonly<Record<string, FactorValue>>): readonly string[] {
  return factorIds.filter((id) => !valuesEqual(leftFactors[id], rightFactors[id]));
}
const valuesEqual = (left: FactorValue | undefined, right: FactorValue | undefined): boolean => typeof left === "number" && typeof right === "number" ? Math.abs(left - right) < 1e-9 : left === right;
