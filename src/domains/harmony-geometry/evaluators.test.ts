import { describe, expect, it } from "vitest";
import { defaultFactorsFor } from "../../curriculum/contracts";
import { evaluatePitchClass, evaluateVoiceLeading } from "./evaluators";
import { harmonyGeometryDefinition } from "./lessons";

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
});
