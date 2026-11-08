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
      expect.objectContaining({ id: "meterScore", label: "Chance-corrected alignment score", value: 0 }),
      expect.objectContaining({ id: "spectralBin", label: "Strongest non-DC bin (0 = none)", value: expect.any(Number) }),
    ]));
    expect(evaluation.observables.every((observable) =>
      typeof observable.value !== "number" || Number.isFinite(observable.value),
    )).toBe(true);
    expect(evaluation.trace.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });

  it("reports the same lowest strongest spectral bin for every rotation", () => {
    const evaluate = evaluatorFor("rhythm-meter", "autocorrelation-spectrum-meter");
    for (const steps of [12, 16]) {
      const bins = new Set<unknown>();
      for (let rotation = -12; rotation <= 12; rotation += 1) {
        bins.add(evaluate({ steps, pulses: 5, rotation }).observables.find((observable) => observable.id === "spectralBin")?.value);
      }
      expect(bins.size).toBe(1);
      expect([...bins][0]).toBeLessThanOrEqual(steps / 2);
    }
  });

  it("derives the recorded-onset count from the plotted strengths and the threshold", () => {
    const evaluate = evaluatorFor("rhythm-meter", "recorded-onset-hypotheses");
    let previous = Infinity;
    for (let threshold = 0.05; threshold <= 0.951; threshold += 0.05) {
      const output = evaluate({ tempoBpm: 100, threshold, meterBias: "mixed" });
      const kept = output.trace.filter((point) => point.series === "Above threshold");
      const count = output.observables.find((observable) => observable.id === "onsetCount")?.value;
      expect(count).toBe(kept.length);
      expect(kept.every((point) => point.y >= threshold)).toBe(true);
      expect(kept.length).toBeLessThanOrEqual(previous);
      previous = kept.length;
    }
  });
});
