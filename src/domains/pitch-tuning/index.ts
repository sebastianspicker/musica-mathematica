import { defineDomain } from "../../curriculum/registry";
import {
  evaluateRatiosLogsCents,
  evaluateTemperamentsAndCommas,
  evaluateTimbreChangesConsonance,
} from "./evaluators";
import { pitchTuningDefinition as definition } from "./lessons";

export const pitchTuningDomain = defineDomain(definition, {
  "ratios-logs-cents": evaluateRatiosLogsCents,
  "temperaments-and-commas": evaluateTemperamentsAndCommas,
  "timbre-changes-consonance": evaluateTimbreChangesConsonance,
});
