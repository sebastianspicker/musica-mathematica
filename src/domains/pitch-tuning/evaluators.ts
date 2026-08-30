import { beatingRateHz, centsToRatio, edoStepsToRatio, nearestEdoSteps, ratioToCents } from "./model";
import { axes, numberFactor, observableValues as observable, resultValues as result, signed } from "../support/evaluation";
import type { EvaluationOutput, FactorValue, TracePoint } from "../../curriculum/contracts";

type Factors = Readonly<Record<string, FactorValue>>;

export function evaluateRatiosLogsCents(factors: Factors): EvaluationOutput {
  const numerator = numberFactor(factors, "numerator");
  const denominator = numberFactor(factors, "denominator");
  const referenceHz = numberFactor(factors, "referenceHz");
  const ratio = numerator / denominator;
  const cents = ratioToCents(ratio);
  return result(
    "Logarithmic interval",
    `${ratio.toFixed(5)} = ${cents.toFixed(2)} cents`,
    [
      observable("ratio", "Frequency ratio", ratio, null, "math.identity", 5),
      observable("cents", "Interval size", cents, "cents", "math.identity", 2),
      observable("targetFrequency", "Target frequency", referenceHz * ratio, "Hz", "math.identity", 2),
      observable("inverseRatio", "Inverse cents check", centsToRatio(cents), null, "math.identity", 5),
    ],
    Array.from({ length: 12 }, (_, index) => ({ x: index, y: referenceHz * 2 ** (index / 12), series: "12-EDO reference" })),
    "pitch",
    "The calculation fixes a reference frequency; pitch spelling, function, and preference are outside it.",
    axes("Equal-temperament step", "semitones", "Frequency", "Hz"),
  );
}

export function evaluateTemperamentsAndCommas(factors: Factors): EvaluationOutput {
  const divisions = Math.round(numberFactor(factors, "divisions"));
  const ratio = numberFactor(factors, "numerator") / numberFactor(factors, "denominator");
  const referenceHz = numberFactor(factors, "referenceHz");
  const steps = nearestEdoSteps(ratio, divisions);
  const approximation = edoStepsToRatio(steps, divisions);
  const error = ratioToCents(approximation / ratio);
  const beating = beatingRateHz(referenceHz * ratio, referenceHz * approximation);
  return result(
    "Temperament approximation",
    `${steps} steps of ${divisions}-EDO; ${signed(error, 2)} cents`,
    [
      observable("steps", "Nearest EDO steps", steps, null, "math.identity", 0),
      observable("approximation", "Approximating ratio", approximation, null, "math.identity", 6),
      observable("centsError", "Signed cents error", error, "cents", "math.identity", 2),
      observable("beating", "Idealized frequency separation", beating, "Hz", "heuristic.transparent", 2),
    ],
    Array.from({ length: divisions + 1 }, (_, index) => ({ x: index, y: edoStepsToRatio(index, divisions), series: `${divisions}-EDO` })),
    "pitch",
    "Frequency separation is an ideal beating proxy; instrument spectra and listening context change the experience.",
    axes("EDO step", "steps", "Frequency ratio", null),
  );
}

export function evaluateTimbreChangesConsonance(factors: Factors): EvaluationOutput {
  const intervalCents = numberFactor(factors, "intervalCents");
  const partialCount = Math.round(numberFactor(factors, "partialCount"));
  const rolloff = numberFactor(factors, "rolloff");
  const ratio = centsToRatio(intervalCents);
  let coincidence = 0;
  let roughnessProxy = 0;
  const trace: TracePoint[] = [];
  for (let partial = 1; partial <= partialCount; partial += 1) {
    const amplitude = 1 / partial ** rolloff;
    trace.push({ x: partial, y: amplitude, series: "Lower tone partials" });
    trace.push({ x: partial * ratio, y: amplitude, series: "Upper tone partials" });
    for (let other = 1; other <= partialCount; other += 1) {
      const distance = Math.abs(partial - other * ratio);
      const weight = amplitude / other ** rolloff;
      if (distance < 0.025) coincidence += weight;
      roughnessProxy += weight * Math.exp(-8 * distance) * (1 - Math.exp(-25 * distance));
    }
  }
  return result(
    "Transparent spectral proxies",
    `${coincidence.toFixed(2)} weighted partial coincidence`,
    [
      observable("coincidence", "Weighted partial coincidence", coincidence, null, "heuristic.transparent", 2),
      observable("roughness", "Pairwise roughness proxy", roughnessProxy, null, "heuristic.transparent", 2),
      observable("ratio", "Fundamental ratio", ratio, null, "math.identity", 5),
    ],
    trace,
    "spectrum",
    "These proxies support within-model comparison only; they do not score consonance or preference.",
    axes("Partial frequency ratio", null, "Partial amplitude", null),
  );
}
