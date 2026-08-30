import { defineDomain } from "../../curriculum/registry";
import { evaluateDescriptiveComparison, evaluateParameterRecovery, evaluateUncertainty } from "./evaluators";
import { measurementInferenceDefinition as definition } from "./lessons";

export const measurementInferenceDomain = defineDomain(definition, {
  "provenance-and-uncertainty": evaluateUncertainty,
  "recovering-parameters": evaluateParameterRecovery,
  "compare-without-grading": evaluateDescriptiveComparison,
});
