import { defineDomain } from "../../curriculum/registry";
import {
  evaluateFromBpmToPeriod,
  evaluatePhaseOnTheCircle,
  evaluatePolyrhythmReturnTimes,
} from "./evaluators";
import { phaseProportionDefinition as definition } from "./lessons";

export const phaseProportionDomain = defineDomain(definition, {
  "from-bpm-to-period": evaluateFromBpmToPeriod,
  "polyrhythm-return-times": evaluatePolyrhythmReturnTimes,
  "phase-on-the-circle": evaluatePhaseOnTheCircle,
});
