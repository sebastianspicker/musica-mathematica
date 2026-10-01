import { describe, expect, it } from "vitest";
import { createCurriculumRegistry } from "../../curriculum/registry";
import { pitchTuningDomain } from "./index";

const { evaluatorFor } = createCurriculumRegistry([pitchTuningDomain]);

const value = (output: ReturnType<ReturnType<typeof evaluatorFor>>, id: string) => (
  output.observables.find((observable) => observable.id === id)?.value
);

describe("pitch-tuning evaluators", () => {
  it("expresses the 3/2 fifth as 701.955 cents", () => {
    const output = evaluatorFor("pitch-tuning", "ratios-logs-cents")({ numerator: 3, denominator: 2, referenceHz: 220 });

    expect(value(output, "ratio")).toBe(1.5);
    expect(value(output, "cents")).toBeCloseTo(701.955, 3);
    expect(value(output, "targetFrequency")).toBeCloseTo(330, 9);
  });

  it("approximates 3/2 by 7 steps of 12-EDO with about -1.955 cents error", () => {
    const output = evaluatorFor("pitch-tuning", "temperaments-and-commas")({
      divisions: 12,
      numerator: 3,
      denominator: 2,
      referenceHz: 220,
    });

    expect(value(output, "steps")).toBe(7);
    expect(value(output, "centsError")).toBeCloseTo(-1.955, 3);
    expect(value(output, "approximation")).toBeCloseTo(2 ** (7 / 12), 6);
  });
});
