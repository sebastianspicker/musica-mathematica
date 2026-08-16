import type { EnsembleConfig } from "../simulation/ensemble";
import type { RunSnapshot } from "./lessonAttempt";

const configKeys: readonly (keyof EnsembleConfig)[] = [
  "musicianCount",
  "tempoBpm",
  "tempoSpreadBpm",
  "couplingStrength",
  "latencySeconds",
  "jitterSeconds",
  "topology",
  "repertoireTexture",
  "clickTrackStrength",
];

export type ComparisonAssessment = {
  changedFields: readonly (keyof EnsembleConfig)[];
  reason: string;
  valid: boolean;
};

export type ComparisonMode = "single-control" | "all-recommended-controls";

export function assessControlledComparison(
  runs: readonly RunSnapshot[],
  recommendedControls: readonly (keyof EnsembleConfig)[],
  mode: ComparisonMode = "single-control",
): ComparisonAssessment {
  const runPair = latestRunPair(runs);
  if (!runPair) {
    return {
      changedFields: [],
      reason: "Record two runs before comparing them.",
      valid: false,
    };
  }

  const changedFields = changedConfigFields(...runPair);
  const failureReason = comparisonFailureReason(changedFields, recommendedControls, mode);
  if (failureReason) {
    return {
      changedFields,
      reason: failureReason,
      valid: false,
    };
  }

  return {
    changedFields,
    reason: `Comparable runs; changed ${changedFields.join(", ")}.`,
    valid: true,
  };
}

function latestRunPair(runs: readonly RunSnapshot[]): readonly [RunSnapshot, RunSnapshot] | undefined {
  const right = runs.at(-1);
  const left = runs.at(-2);
  return left && right ? [left, right] : undefined;
}

function changedConfigFields(
  left: RunSnapshot,
  right: RunSnapshot,
): readonly (keyof EnsembleConfig)[] {
  return configKeys.filter((key) => !configValuesEqual(left.config[key], right.config[key]));
}

function comparisonFailureReason(
  changedFields: readonly (keyof EnsembleConfig)[],
  recommendedControls: readonly (keyof EnsembleConfig)[],
  mode: ComparisonMode,
): string | undefined {
  if (changedFields.length === 0) {
    return "Change at least one recommended control between the two runs.";
  }

  const recommended = new Set<keyof EnsembleConfig>(recommendedControls);
  const unrelatedChanges = changedFields.filter((field) => !recommended.has(field));
  if (unrelatedChanges.length > 0) {
    return `Hold unrelated controls constant: ${unrelatedChanges.join(", ")}.`;
  }

  return modeFailureReason(changedFields, recommendedControls, mode);
}

function modeFailureReason(
  changedFields: readonly (keyof EnsembleConfig)[],
  recommendedControls: readonly (keyof EnsembleConfig)[],
  mode: ComparisonMode,
): string | undefined {
  if (mode === "single-control") {
    return changedFields.length === 1
      ? undefined
      : "For a controlled comparison, change exactly one recommended control between runs.";
  }

  if (mode === "all-recommended-controls") {
    return recommendedControls.every((control) => changedFields.includes(control))
      ? undefined
      : `This strategy comparison requires changing: ${recommendedControls.join(", ")}.`;
  }

  return undefined;
}

function configValuesEqual(
  left: EnsembleConfig[keyof EnsembleConfig],
  right: EnsembleConfig[keyof EnsembleConfig],
): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) < 1e-9;
  }
  return left === right;
}
