/** Generic curriculum-definition constructors shared by domain-owned lessons. */
import type {
  CurriculumDomainId,
  FactorDefinition,
  InputMode,
  LessonDefinition,
  NumberFactor,
  SelectFactor,
  ToggleFactor,
} from "../../curriculum/contracts";

export const numberFactor = (
  id: string,
  label: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
  unit: string,
  help: string,
  options: Readonly<{ audioSetting?: NumberFactor["audioSetting"] }> = {},
): NumberFactor => ({ id, kind: "number", label, defaultValue, min, max, step, unit, help, ...options });

export const selectFactor = (
  id: string,
  label: string,
  defaultValue: string,
  options: readonly Readonly<{ value: string; label: string }>[],
  help: string,
  settings: Readonly<{ audioSetting?: SelectFactor["audioSetting"] }> = {},
): SelectFactor => ({ id, kind: "select", label, defaultValue, options, help, ...settings });

export const toggleFactor = (
  id: string,
  label: string,
  defaultValue: boolean,
  help: string,
): ToggleFactor => ({ id, kind: "toggle", label, defaultValue, help });

type LessonFields<Id extends string> = Omit<LessonDefinition, "id" | "domainId" | "number" | "protocol" | "inputModes"> & {
  id: Id;
  factors: readonly FactorDefinition[];
  inputModes?: readonly InputMode[];
  deterministic?: boolean;
  durationSeconds?: number;
  seed?: string;
};

export function lesson<const DomainId extends CurriculumDomainId, const Id extends string>(
  domainId: DomainId,
  number: 1 | 2 | 3,
  fields: LessonFields<Id>,
): LessonDefinition & Readonly<{ id: Id; domainId: DomainId }> {
  return {
    ...fields,
    domainId,
    number,
    inputModes: fields.inputModes ?? ["synthetic"],
    protocol: {
      id: `${domainId}.${fields.id}.v1`,
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
