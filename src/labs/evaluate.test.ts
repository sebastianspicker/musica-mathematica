import { describe, expect, it } from "vitest";
import { allLessons } from "./catalog";
import { evaluateLesson } from "./evaluate";
import { defaultFactorsFor, type LabLesson } from "./types";

function lesson(id: string): LabLesson {
  const selected = allLessons.find((candidate) => candidate.id === id);
  if (!selected) throw new Error(`Missing lesson ${id}`);
  return selected;
}

function observableValue(evaluation: ReturnType<typeof evaluateLesson>, id: string): number | string {
  const selected = evaluation.observables.find((candidate) => candidate.id === id);
  if (!selected) throw new Error(`Missing observable ${id}`);
  return selected.value;
}

describe("mathematical lesson semantics", () => {
  it("uses the published I_n convention for a nonzero pitch-class index", () => {
    const selected = lesson("pitch-class-symmetry");
    const evaluation = evaluateLesson(selected, { ...defaultFactorsFor(selected), axis: 5, invert: true });

    expect(observableValue(evaluation, "transformed")).toBe("{5, 1, 10}");
  });

  it("changes the shortest-path observable when the selected graph family changes", () => {
    const selected = lesson("tonnetz-and-voice-leading");
    const factors = { ...defaultFactorsFor(selected), chordA: "C", chordB: "G" };
    const tonnetz = evaluateLesson(selected, { ...factors, metric: "tonnetz" });
    const chromatic = evaluateLesson(selected, { ...factors, metric: "chromatic" });

    expect(observableValue(tonnetz, "graphPath")).toBe("C → Em → G");
    expect(observableValue(tonnetz, "graphCost")).toBe(2);
    expect(observableValue(chromatic, "graphPath")).toBe("C → G");
    expect(observableValue(chromatic, "graphCost")).toBe(5);
  });

  it("treats 3:2 as pulses within one shared cycle and converts that cycle once", () => {
    const selected = lesson("polyrhythm-return-times");
    const evaluation = evaluateLesson(selected, { ...defaultFactorsFor(selected), pulseA: 3, pulseB: 2, bpm: 90 });
    const lattice = evaluation.observables.find((candidate) => candidate.id === "lcm");
    const realignment = evaluation.observables.find((candidate) => candidate.id === "realignment");
    const duration = evaluation.observables.find((candidate) => candidate.id === "returnSeconds");
    const endpoint = evaluation.trace.filter((point) => point.x === 6);
    const pulseAFactor = selected.factors.find((factor) => factor.id === "pulseA");

    expect(pulseAFactor).toMatchObject({ label: "Layer A pulses", unit: "pulses / shared cycle" });
    expect(lattice).toMatchObject({ label: "Onset-lattice resolution", value: 6, unit: "subdivisions / shared cycle" });
    expect(realignment).toMatchObject({ label: "Exact realignment", value: 1, unit: "shared cycle" });
    expect(duration).toMatchObject({ value: 60 / 90, unit: "s" });
    expect(endpoint.map((point) => point.series)).toEqual([
      "Layer A (3 pulses / shared cycle)",
      "Layer B (2 pulses / shared cycle)",
    ]);
  });
});
