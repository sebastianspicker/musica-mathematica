import { defineDomain } from "../../curriculum/registry";
import { evaluateChordHypotheses, evaluatePitchClass, evaluateVoiceLeading } from "./evaluators";
import { harmonyGeometryDefinition as definition } from "./lessons";

export const harmonyGeometryDomain = defineDomain(definition, {
  "pitch-class-symmetry": evaluatePitchClass,
  "tonnetz-and-voice-leading": evaluateVoiceLeading,
  "chord-hypotheses": evaluateChordHypotheses,
});
