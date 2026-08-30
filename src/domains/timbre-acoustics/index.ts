import { defineDomain } from "../../curriculum/registry";
import { evaluateAliasing, evaluateResonance, evaluateTimeVaryingTimbre } from "./evaluators";
import { timbreAcousticsDefinition as definition } from "./lessons";

export const timbreAcousticsDomain = defineDomain(definition, {
  "resonance-modes-partials": evaluateResonance,
  "fourier-windows-aliasing": evaluateAliasing,
  "time-varying-timbre": evaluateTimeVaryingTimbre,
});
