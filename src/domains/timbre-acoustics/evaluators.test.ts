import { describe, expect, it } from "vitest";
import { defaultFactorsFor } from "../../curriculum/contracts";
import { evaluateResonance } from "./evaluators";
import { timbreAcousticsDefinition } from "./lessons";

describe("timbre-acoustics evaluators", () => {
  it("retains the ideal-string fundamental", () => {
    const evaluation = evaluateResonance(defaultFactorsFor(timbreAcousticsDefinition.lessons[0]));

    expect(evaluation.result).toBe("f1 = 110.00 Hz");
  });
});
