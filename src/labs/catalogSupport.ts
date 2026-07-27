import type {
  FactorDefinition,
  LabId,
  LabLesson,
  NumberFactor,
  SelectFactor,
  ToggleFactor,
} from "./types";

export const numberFactor = (
  id: string,
  label: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
  unit: string,
  help: string,
): NumberFactor => ({ id, kind: "number", label, defaultValue, min, max, step, unit, help });

export const selectFactor = (
  id: string,
  label: string,
  defaultValue: string,
  options: readonly Readonly<{ value: string; label: string }>[],
  help: string,
): SelectFactor => ({ id, kind: "select", label, defaultValue, options, help });

export const toggleFactor = (
  id: string,
  label: string,
  defaultValue: boolean,
  help: string,
): ToggleFactor => ({ id, kind: "toggle", label, defaultValue, help });

type LessonFields = Omit<LabLesson, "labId" | "number" | "protocol" | "inputModes"> & {
  factors: readonly FactorDefinition[];
  inputModes?: LabLesson["inputModes"];
  deterministic?: boolean;
  durationSeconds?: number;
  seed?: string;
};

export function lesson(labId: LabId, number: 1 | 2 | 3, fields: LessonFields): LabLesson {
  return {
    ...fields,
    labId,
    number,
    inputModes: fields.inputModes ?? ["synthetic"],
    protocol: {
      id: `${labId}.${fields.id}.v1`,
      deterministic: fields.deterministic ?? true,
      durationSeconds: fields.durationSeconds ?? 8,
      ...(fields.seed ? { seed: fields.seed } : {}),
    },
  };
}

export const commonClaims = ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"];
export const contextualClaims = ["model.deterministic", "literature.context", "heuristic.transparent", "recommendation.inquiry"];

export function chordOptions(): readonly Readonly<{ value: string; label: string }>[] {
  return [
    { value: "C", label: "C major" },
    { value: "G", label: "G major" },
    { value: "F", label: "F major" },
    { value: "Am", label: "A minor" },
    { value: "Em", label: "E minor" },
    { value: "Dm", label: "D minor" },
  ];
}
