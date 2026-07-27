import {
  createSeededRandom,
  entropy,
  generateMarkovSequence,
  stationaryDistribution,
  surprisal,
} from "../probability-form/model";
import {
  axes,
  numberFactor,
  observable,
  result,
  SYNTHETIC_PROVENANCE,
} from "../evaluationSupport";
import type { FactorValue, LabEvaluation } from "../types";

function seededBinarySequence(probability: number, length: number, seed: number): number[] {
  const random = createSeededRandom(seed);
  return Array.from({ length }, () => random() < probability ? 1 : 0);
}

function seededBinaryInputs(factors: Readonly<Record<string, FactorValue>>) {
  const probability = numberFactor(factors, "probability");
  const length = Math.round(numberFactor(factors, "length"));
  const seed = Math.round(numberFactor(factors, "seed"));
  return { probability, length, seed };
}

function seededEventTrace(sequence: readonly number[]) {
  return sequence.map((value, index) => ({ x: index, y: value, series: "Seeded events" }));
}

export function evaluateSeededChance(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
  const { probability, length, seed } = seededBinaryInputs(factors);
  const sequence = seededBinarySequence(probability, length, seed);
  const eventCount = sequence.reduce<number>((sum, value) => sum + value, 0);
  const observed = eventCount / length;
  return result({
    headline: "Seeded finite realization",
    result: `${eventCount} A events of ${length}`,
    observables: [
      observable({ id: "expected", label: "Declared probability", value: probability, unit: null, claimId: "math.identity", precision: 3 }),
      observable({ id: "observed", label: "Observed finite proportion", value: observed, unit: null, claimId: "model.deterministic", precision: 3 }),
      observable({ id: "difference", label: "Observed − declared", value: observed - probability, unit: null, claimId: "model.deterministic", precision: 3 }),
    ],
    trace: seededEventTrace(sequence),
    visualKind: "distribution",
    annotation: `Seed ${seed} reproduces this realization; a different finite realization need not equal the declared probability.`,
    traceAxes: axes("Event index", "events", "Event state", null),
    provenance: SYNTHETIC_PROVENANCE,
  });
}

export function evaluateMarkov(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
  const stay = numberFactor(factors, "stayProbability");
  const length = Math.round(numberFactor(factors, "length"));
  const seed = Math.round(numberFactor(factors, "seed"));
  const matrix = [[stay, 1 - stay], [1 - stay, stay]];
  const sequence = generateMarkovSequence(matrix, 0, length, createSeededRandom(seed));
  const stationary = stationaryDistribution(matrix);
  let transitions = 0;
  for (let index = 1; index < sequence.length; index += 1) if (sequence[index] !== sequence[index - 1]) transitions += 1;
  return result({
    headline: "Seeded Markov realization",
    result: `${transitions} state changes in ${length} events`,
    observables: [
      observable({ id: "transitions", label: "State changes", value: transitions, unit: null, claimId: "model.deterministic", precision: 0 }),
      observable({ id: "stationaryA", label: "Stationary probability A", value: stationary[0], unit: null, claimId: "math.identity", precision: 3 }),
      observable({ id: "stationaryB", label: "Stationary probability B", value: stationary[1], unit: null, claimId: "math.identity", precision: 3 }),
    ],
    trace: sequence.map((value, index) => ({ x: index, y: value, series: "Markov state" })),
    visualKind: "distribution",
    annotation: "First-order state memory creates local dependence but does not plan long-range musical form.",
    traceAxes: axes("Event index", "events", "Markov state", null),
    provenance: SYNTHETIC_PROVENANCE,
  });
}

export function evaluateInformation(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
  const { probability, length, seed } = seededBinaryInputs(factors);
  const distribution = [probability, 1 - probability];
  const information = entropy(distribution);
  const rareProbability = Math.min(...distribution);
  const sequence = seededBinarySequence(probability, length, seed + length);
  return result({
    headline: "Information quantities",
    result: `H = ${information.toFixed(3)} bits/event`,
    observables: [
      observable({ id: "entropy", label: "Binary entropy", value: information, unit: "bits/event", claimId: "math.identity", precision: 3 }),
      observable({ id: "rareSurprisal", label: "Rarer-event surprisal", value: surprisal(rareProbability), unit: "bits", claimId: "math.identity", precision: 3 }),
      observable({ id: "sampleLength", label: "Finite realization", value: length, unit: "events", claimId: "model.deterministic", precision: 0 }),
    ],
    trace: seededEventTrace(sequence),
    visualKind: "distribution",
    annotation: "Entropy depends on the declared event alphabet and probabilities; it is not creativity, interest, or quality.",
    traceAxes: axes("Event index", "events", "Event state", null),
    provenance: SYNTHETIC_PROVENANCE,
  });
}
