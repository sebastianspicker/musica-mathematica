import { describe, expect, it } from "vitest";
import { defaultFactorsFor } from "../../curriculum/contracts";
import { evaluateUncertainty } from "./evaluators";
import { measurementInferenceDefinition } from "./lessons";

describe("measurement-inference evaluators", () => {
  it("retains the synthetic uncertainty summary", () => {
    const evaluation = evaluateUncertainty(defaultFactorsFor(measurementInferenceDefinition.lessons[0]));

    expect(evaluation).toMatchObject({ headline: "Synthetic uncertainty summary" });
    expect(evaluation.observables).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "mean", aggregation: "distribution" }),
      expect.objectContaining({ id: "standardError", aggregation: "distribution" }),
    ]));
  });
});
