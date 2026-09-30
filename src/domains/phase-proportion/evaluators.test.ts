import { describe, expect, it } from "vitest";
import { evaluatorFor } from "../../curriculum/catalog";

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
});
