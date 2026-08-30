import { defineDomain } from "../../curriculum/registry";
import {
  evaluateDelayJitterTopology,
  evaluateExternalPulseOrPeerAdaptation,
  evaluateLockInAndOrder,
} from "./evaluators";
import { ensembleDynamicsDefinition as definition } from "./lessons";

export const ensembleDynamicsDomain = defineDomain(definition, {
  "lock-in-and-order": evaluateLockInAndOrder,
  "delay-jitter-topology": evaluateDelayJitterTopology,
  "external-pulse-or-peer-adaptation": evaluateExternalPulseOrPeerAdaptation,
});
