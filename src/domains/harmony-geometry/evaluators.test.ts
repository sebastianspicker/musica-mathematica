import { describe, expect, it } from "vitest";
import { defaultFactorsFor } from "../../curriculum/contracts";
import { createCurriculumRegistry } from "../../curriculum/registry";
import { evaluatePitchClass, evaluateVoiceLeading } from "./evaluators";
import { harmonyGeometryDomain } from "./index";
import { harmonyGeometryDefinition } from "./lessons";

const { evaluatorFor } = createCurriculumRegistry([harmonyGeometryDomain]);

function observableValue(evaluation: ReturnType<typeof evaluatePitchClass>, id: string): number | string {
  const selected = evaluation.observables.find((candidate) => candidate.id === id);
  if (!selected) throw new Error(`Missing observable ${id}`);
  return selected.value;
}

describe("harmony-geometry evaluators", () => {
  it("retains transformation and graph-path semantics", () => {
    const [symmetry, voiceLeading] = harmonyGeometryDefinition.lessons;
    const transformed = evaluatePitchClass({ ...defaultFactorsFor(symmetry), axis: 5, invert: true });
    const graph = evaluateVoiceLeading({ ...defaultFactorsFor(voiceLeading), chordA: "C", chordB: "G" });

    expect(transformed.result).toBe("{5, 1, 10}");
    expect(graph.observables).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "graphPath", value: "C → Em → G" }),
      expect.objectContaining({ id: "graphCost", value: 2 }),
    ]));
  });

  it("uses the published I_n convention for a nonzero pitch-class index", () => {
    const selected = harmonyGeometryDefinition.lessons.find((candidate) => candidate.id === "pitch-class-symmetry");
    if (!selected) throw new Error("Missing lesson pitch-class-symmetry");
    const evaluation = evaluatorFor("harmony-geometry", selected.id)({ ...defaultFactorsFor(selected), axis: 5, invert: true });

    expect(observableValue(evaluation, "transformed")).toBe("{5, 1, 10}");
  });

  it("changes the shortest-path observable when the selected graph family changes", () => {
    const selected = harmonyGeometryDefinition.lessons.find((candidate) => candidate.id === "tonnetz-and-voice-leading");
    if (!selected) throw new Error("Missing lesson tonnetz-and-voice-leading");
    const evaluate = evaluatorFor("harmony-geometry", selected.id);
    const factors = { ...defaultFactorsFor(selected), chordA: "C", chordB: "G" };
    const tonnetz = evaluate({ ...factors, metric: "tonnetz" });
    const chromatic = evaluate({ ...factors, metric: "chromatic" });

    expect(observableValue(tonnetz, "graphPath")).toBe("C → Em → G");
    expect(observableValue(tonnetz, "graphCost")).toBe(2);
    expect(observableValue(chromatic, "graphPath")).toBe("C → G");
    expect(observableValue(chromatic, "graphCost")).toBe(5);
  });
});
