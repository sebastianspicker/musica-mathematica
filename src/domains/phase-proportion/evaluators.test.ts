import { describe, expect, it } from "vitest";
import { defaultFactorsFor, type LessonDefinition } from "../../curriculum/contracts";
import { createCurriculumRegistry } from "../../curriculum/registry";
import { phaseProportionDomain } from "./index";
import { normalizeCircularPhase } from "./model";

const { evaluatorFor } = createCurriculumRegistry([phaseProportionDomain]);

const lessonNamed = (id: string): LessonDefinition => {
  const selected = phaseProportionDomain.definition.lessons.find((candidate) => candidate.id === id);
  if (!selected) throw new Error(`Missing lesson ${id}`);
  return selected;
};

const value = (output: ReturnType<ReturnType<typeof evaluatorFor>>, id: string) => (
  output.observables.find((observable) => observable.id === id)?.value
);

describe("phase-proportion evaluators", () => {
  it("converts tempo to beat period as 60 / bpm", () => {
    const output = evaluatorFor("phase-proportion", "from-bpm-to-period")({ bpm: 120, beatsPerBar: 4 });

    expect(value(output, "period")).toBeCloseTo(0.5, 12);
    expect(value(output, "barDuration")).toBeCloseTo(2, 12);
    expect(value(output, "inverseTempo")).toBeCloseTo(120, 9);
  });

  it("finds the least common multiple of a 3:2 polyrhythm", () => {
    const output = evaluatorFor("phase-proportion", "polyrhythm-return-times")({ pulseA: 3, pulseB: 2, bpm: 90 });

    expect(value(output, "gcd")).toBe(1);
    expect(value(output, "lcm")).toBe(6);
  });

  it("treats 3:2 as pulses within one shared cycle and converts that cycle once", () => {
    const selected = lessonNamed("polyrhythm-return-times");
    const evaluation = evaluatorFor("phase-proportion", selected.id)({ ...defaultFactorsFor(selected), pulseA: 3, pulseB: 2, bpm: 90 });
    const lattice = evaluation.observables.find((candidate) => candidate.id === "lcm");
    const duration = evaluation.observables.find((candidate) => candidate.id === "returnSeconds");
    const endpoint = evaluation.trace.filter((point) => point.x === 6);
    const pulseAFactor = selected.factors.find((factor) => factor.id === "pulseA");

    expect(pulseAFactor).toMatchObject({ label: "Layer A pulses", unit: "pulses / shared cycle" });
    expect(lattice).toMatchObject({ label: "Onset-lattice resolution", value: 6, unit: "subdivisions / shared cycle" });
    expect(duration).toMatchObject({ value: 60 / 90, unit: "s" });
    expect(endpoint.map((point) => point.series)).toEqual([
      "Layer A (3 pulses / shared cycle)",
      "Layer B (2 pulses / shared cycle)",
    ]);
  });

  it("snaps phases that round to a full cycle back to zero", () => {
    expect(normalizeCircularPhase(1 - 1e-13)).toBe(0);
    expect(normalizeCircularPhase(-1e-13)).toBe(0);
    expect(normalizeCircularPhase(0.5)).toBe(0.5);
    const output = evaluatorFor("phase-proportion", "phase-on-the-circle")({ periodA: 0.2, periodB: 1, elapsed: 0.6, offset: 0 });
    expect(output.observables.find((observable) => observable.id === "phaseA")?.value).toBe(0);
  });
});
