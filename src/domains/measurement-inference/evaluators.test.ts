import { describe, expect, it } from "vitest";
import { defaultFactorsFor } from "../../curriculum/contracts";
import { claimById } from "../../curriculum/evidence";
import { evaluateUncertainty } from "./evaluators";
import { measurementInferenceDomain } from "./index";
import { measurementInferenceDefinition } from "./lessons";
import { deterministicCenteredSample } from "./model";

describe("measurement-inference evaluators", () => {
  it("retains the synthetic uncertainty summary", () => {
    const evaluation = evaluateUncertainty(defaultFactorsFor(measurementInferenceDefinition.lessons[0]));

    expect(evaluation).toMatchObject({ headline: "Synthetic uncertainty summary" });
    expect(evaluation.observables).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "mean", aggregation: "distribution" }),
      expect.objectContaining({ id: "standardError", aggregation: "distribution" }),
    ]));
  });

  it("cites neither measured-observation nor transcription-hypothesis claims for synthetic fixtures", () => {
    for (const lesson of measurementInferenceDefinition.lessons) {
      const evaluator = measurementInferenceDomain.evaluators[lesson.id as keyof typeof measurementInferenceDomain.evaluators];
      for (const observable of evaluator(defaultFactorsFor(lesson)).observables) {
        expect(["measured-observation", "transcription-hypothesis"]).not.toContain(claimById(observable.claimId)?.kind);
      }
    }
  });

  it("gives neighbouring seeds clearly different first samples", () => {
    const first = Array.from({ length: 10 }, (_, seed) => deterministicCenteredSample(0, 1, 1, seed)[0]).sort((a, b) => a - b);
    for (let index = 1; index < first.length; index += 1) expect(first[index] - first[index - 1]).toBeGreaterThanOrEqual(0.01);
  });
});
