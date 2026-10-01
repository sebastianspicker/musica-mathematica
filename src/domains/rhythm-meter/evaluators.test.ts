import { describe, expect, it } from "vitest";
import { defaultFactorsFor } from "../../curriculum/contracts";
import { createCurriculumRegistry } from "../../curriculum/registry";
import { rhythmMeterDomain } from "./index";

const { evaluatorFor } = createCurriculumRegistry([rhythmMeterDomain]);

describe("rhythm-meter evaluators", () => {
  it("distributes 3 onsets over 8 steps as the Euclidean tresillo", () => {
    const output = evaluatorFor("rhythm-meter", "cycles-and-euclidean-rhythm")({ steps: 8, pulses: 3, rotation: 0 });
    const value = (id: string) => output.observables.find((observable) => observable.id === id)?.value;

    expect(output.result).toBe("1 0 0 1 0 0 1 0");
    expect(value("onsets")).toBe(3);
    expect(value("density")).toBe(3 / 8);
    expect(value("cycleLength")).toBe(8);
  });

  it("preserves onset count under rotation", () => {
    const evaluate = evaluatorFor("rhythm-meter", "cycles-and-euclidean-rhythm");
    const onsets = (rotation: number) => evaluate({ steps: 8, pulses: 3, rotation })
      .observables.find((observable) => observable.id === "onsets")?.value;

    expect(onsets(3)).toBe(3);
    expect(onsets(-5)).toBe(3);
  });

  it("reports an explicit no-candidate result for valid prime cycle lengths", () => {
    const selected = rhythmMeterDomain.definition.lessons.find((candidate) => candidate.id === "autocorrelation-spectrum-meter");
    if (!selected) throw new Error("Missing lesson autocorrelation-spectrum-meter");
    const factors = { ...defaultFactorsFor(selected), steps: 11, pulses: 5, rotation: 0 };
    const evaluate = evaluatorFor("rhythm-meter", selected.id);

    expect(() => evaluate(factors)).not.toThrow();
    const evaluation = evaluate(factors);

    expect(evaluation.headline).toBe("Ranked periodicity");
    expect(evaluation.observables).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "topMeter", label: "Top equal-subdivision candidate", value: "none" }),
      expect.objectContaining({ id: "meterScore", label: "Onset-alignment score", value: 0 }),
      expect.objectContaining({ id: "spectralBin", label: "Strongest non-DC bin", value: expect.any(Number) }),
    ]));
    expect(evaluation.observables.every((observable) =>
      typeof observable.value !== "number" || Number.isFinite(observable.value),
    )).toBe(true);
    expect(evaluation.trace.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });
});
