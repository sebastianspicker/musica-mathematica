import { describe, expect, it } from "vitest";
import { defaultFactorsFor } from "../../curriculum/contracts";
import { evaluateSeededChance } from "./evaluators";
import { probabilityFormDefinition } from "./lessons";

describe("probability-form evaluators", () => {
  it("retains reproducible seeded output", () => {
    const factors = defaultFactorsFor(probabilityFormDefinition.lessons[0]);

    expect(evaluateSeededChance(factors)).toEqual(evaluateSeededChance(factors));
  });
});
