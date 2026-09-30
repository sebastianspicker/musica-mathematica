import type { CurriculumDomainId, CurriculumLessonReader, FactorDefinition, LessonDefinition } from "../../curriculum/contracts";

function lesson(
  domainId: CurriculumDomainId,
  id: string,
  factors: readonly FactorDefinition[],
): LessonDefinition {
  return {
    id,
    domainId,
    number: 1,
    level: "foundation",
    title: id,
    shortTitle: id,
    question: "Synthetic question.",
    objective: "Synthetic objective.",
    equation: "x = 1",
    equationCaption: "Synthetic equation.",
    predictionPrompt: "Predict.",
    experimentPrompt: "Experiment.",
    interpretationPrompt: "Interpret.",
    transferPrompt: "Transfer.",
    factors,
    claimIds: ["synthetic"],
    sourceIds: ["synthetic"],
    protocol: { id: `${domainId}.${id}.v1`, deterministic: true, durationSeconds: 1 },
    inputModes: ["synthetic"],
  };
}

const number = (id: string): FactorDefinition => ({
  id,
  kind: "number",
  label: id,
  min: -1_000,
  max: 1_000,
  step: 0.1,
  defaultValue: 1,
  help: "Synthetic.",
});

const topology: FactorDefinition = {
  id: "topology",
  kind: "select",
  label: "Topology",
  defaultValue: "all-to-all",
  options: [
    { value: "all-to-all", label: "All-to-all" },
    { value: "leader-follower", label: "Leader-follower" },
    { value: "sections", label: "Sections" },
  ],
  help: "Synthetic.",
};

const lessons = [
  lesson("phase-proportion", "from-bpm-to-period", [number("bpm"), number("beatsPerBar")]),
  lesson("rhythm-meter", "cycles-and-euclidean-rhythm", []),
  lesson("ensemble-dynamics", "lock-in-and-order", [number("musicianCount"), number("tempoBpm"), number("tempoSpreadBpm"), number("couplingStrength")]),
  lesson("ensemble-dynamics", "delay-jitter-topology", [number("latencyMs"), number("jitterMs"), number("couplingStrength"), topology]),
  lesson("ensemble-dynamics", "external-pulse-or-peer-adaptation", [number("clickTrackStrength"), number("couplingStrength"), number("tempoSpreadBpm"), number("tempoBpm")]),
] as const;

export const testCurriculum: CurriculumLessonReader = {
  defaultLesson: lessons[0],
  lessonById: (domainId, lessonId) => lessons.find((item) => item.domainId === domainId && item.id === lessonId),
};
