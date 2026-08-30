import { defineDomain } from "../../curriculum/registry";
import { evaluateInformation, evaluateMarkov, evaluateSeededChance } from "./evaluators";
import { probabilityFormDefinition as definition } from "./lessons";

export const probabilityFormDomain = defineDomain(definition, {
  "seeded-chance": evaluateSeededChance,
  "markov-memory": evaluateMarkov,
  "entropy-surprisal-form": evaluateInformation,
});
