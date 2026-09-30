import { describe, expect, it } from "vitest";
import { evaluatorFor } from "../../curriculum/catalog";

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
});
