import type { FactorValue, LabLesson, TrialSnapshotV2 } from "../labs/types";

export type TrialComparisonAssessment = Readonly<{
  valid: boolean;
  changedFactorIds: readonly string[];
  reason: string;
}>;

export function assessTrialComparison(
  lesson: LabLesson,
  trials: readonly TrialSnapshotV2[],
): TrialComparisonAssessment {
  const left = trials.at(-2);
  const right = trials.at(-1);
  if (!left || !right) {
    return { valid: false, changedFactorIds: [], reason: "Record two runs before comparing them." };
  }
  const contextFailure = comparisonContextFailure(lesson, left, right);
  if (contextFailure) return { valid: false, changedFactorIds: [], reason: contextFailure };

  const factorIds = lesson.factors.map((factor) => factor.id);
  const changedFactorIds = factorIds.filter((id) => !factorValuesEqual(left.factors[id], right.factors[id]));
  return assessFactorChanges(lesson, left, changedFactorIds);
}

const comparisonContextFailure = (
  lesson: LabLesson,
  left: TrialSnapshotV2,
  right: TrialSnapshotV2,
): string | undefined => {
  if (left.lessonId !== lesson.id || right.lessonId !== lesson.id) return "Both runs must belong to this lesson.";
  if (left.protocolId !== right.protocolId) {
    return "Both runs must use the same lesson protocol. Record two runs with the current protocol.";
  }
  if (left.provenance.source !== right.provenance.source) return "Both runs must use the same analysis source.";
  if (!analysisSettingsEqual(left, right)) {
    return "Hold sample rate, frame size, and hop size constant before comparing audio runs.";
  }
  return undefined;
};

const assessFactorChanges = (
  lesson: LabLesson,
  left: TrialSnapshotV2,
  changedFactorIds: string[],
): TrialComparisonAssessment => {
  if (changedFactorIds.length === 0) {
    return { valid: false, changedFactorIds, reason: "Change one experimental factor before recording Run B." };
  }
  if (changedFactorIds.length > 1) {
    const labels = changedFactorIds.map((id) => lesson.factors.find((factor) => factor.id === id)?.label ?? id);
    return {
      valid: false,
      changedFactorIds,
      reason: `For a controlled comparison, change one factor only. Changed: ${labels.join(", ")}.`,
    };
  }
  const audioFailure = recordedAudioFailure(lesson, left, changedFactorIds[0]);
  if (audioFailure) return { valid: false, changedFactorIds, reason: audioFailure };

  const label = lesson.factors.find((factor) => factor.id === changedFactorIds[0])?.label ?? changedFactorIds[0];
  return { valid: true, changedFactorIds, reason: `Controlled comparison ready: only ${label} changed.` };
};

const recordedAudioFailure = (lesson: LabLesson, trial: TrialSnapshotV2, changedFactorId: string): string | undefined => {
  if (!isRecordedAudioSource(trial.provenance.source)) return undefined;
  if (lesson.id !== "recorded-onset-hypotheses") {
    return "Local audio is an observation appendix in this lesson; use the synthetic model for a controlled A/B comparison.";
  }
  if (changedFactorId !== "threshold" && changedFactorId !== "meterBias") {
    return "For recorded-onset audio, compare a fresh analysis after changing only Onset threshold or Candidate family.";
  }
  return undefined;
};

const analysisSettingsEqual = (left: TrialSnapshotV2, right: TrialSnapshotV2): boolean => {
  return left.provenance.sampleRateHz === right.provenance.sampleRateHz
    && left.provenance.frameSize === right.provenance.frameSize
    && left.provenance.hopSize === right.provenance.hopSize;
};

const isRecordedAudioSource = (source: TrialSnapshotV2["provenance"]["source"]): boolean => {
  return source === "microphone" || source === "file";
};

const factorValuesEqual = (left: FactorValue | undefined, right: FactorValue | undefined): boolean => {
  if (typeof left === "number" && typeof right === "number") return Math.abs(left - right) < 1e-9;
  return left === right;
};
