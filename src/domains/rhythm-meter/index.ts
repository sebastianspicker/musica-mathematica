import { defineDomain } from "../../curriculum/registry";
import {
  evaluateAutocorrelationSpectrumMeter,
  evaluateCyclesAndEuclideanRhythm,
  evaluateRecordedOnsetHypotheses,
} from "./evaluators";
import { rhythmMeterDefinition as definition } from "./lessons";

export const rhythmMeterDomain = defineDomain(definition, {
  "cycles-and-euclidean-rhythm": evaluateCyclesAndEuclideanRhythm,
  "autocorrelation-spectrum-meter": evaluateAutocorrelationSpectrumMeter,
  "recorded-onset-hypotheses": evaluateRecordedOnsetHypotheses,
});
