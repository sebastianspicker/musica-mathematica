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
  const right = runs.at(-1);
  const left = runs.at(-2);
  if (!left || !right) {
    return {
      changedFields: [],
      reason: "Record two runs before comparing them.",
      valid: false,
    };
  }

  const changedFields = configKeys.filter(
    (key) => !configValuesEqual(left.config[key], right.config[key]),
  );
  if (changedFields.length === 0) {
    return {
      changedFields,
      reason: "Change at least one recommended control between the two runs.",
      valid: false,
    };
  }

  const recommended = new Set<keyof EnsembleConfig>(recommendedControls);
  const unrelatedChanges = changedFields.filter((field) => !recommended.has(field));
  if (unrelatedChanges.length > 0) {
    return {
      changedFields,
      reason: `Hold unrelated controls constant: ${unrelatedChanges.join(", ")}.`,
      valid: false,
    };
  }

  if (mode === "single-control" && changedFields.length !== 1) {
    return {
      changedFields,
      reason: "For a controlled comparison, change exactly one recommended control between runs.",
      valid: false,
    };
  }
  if (
    mode === "all-recommended-controls" &&
    recommendedControls.some((control) => !changedFields.includes(control))
  ) {
    return {
      changedFields,
      reason: `This strategy comparison requires changing: ${recommendedControls.join(", ")}.`,
      valid: false,
    };
  }

  return {
    changedFields,
    reason: `Comparable runs; changed ${changedFields.join(", ")}.`,
    valid: true,
  };
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
