import { beatingRateHz, centsToRatio, edoStepsToRatio, nearestEdoSteps, ratioToCents } from "./model";
import { axes, readNumber, observable, result, signed } from "../support/evaluation";
import type { EvaluationOutput, FactorValue, TracePoint } from "../../curriculum/contracts";

type Factors = Readonly<Record<string, FactorValue>>;

export function evaluateRatiosLogsCents(factors: Factors): EvaluationOutput {
  const numerator = readNumber(factors, "numerator");
  const denominator = readNumber(factors, "denominator");
  const referenceHz = readNumber(factors, "referenceHz");
  const ratio = numerator / denominator;
  const cents = ratioToCents(ratio);
  return result({
    headline: "Logarithmic interval",
    result: `${ratio.toFixed(5)} = ${cents.toFixed(2)} cents`,
    observables: [
      observable({ id: "ratio", label: "Frequency ratio", value: ratio, unit: null, claimId: "math.identity", precision: 5 }),
      observable({ id: "cents", label: "Interval size", value: cents, unit: "cents", claimId: "math.identity", precision: 2 }),
      observable({ id: "targetFrequency", label: "Target frequency", value: referenceHz * ratio, unit: "Hz", claimId: "math.identity", precision: 2 }),
      observable({ id: "inverseRatio", label: "Inverse cents check", value: centsToRatio(cents), unit: null, claimId: "math.identity", precision: 5 }),
    ],
    trace: Array.from({ length: 12 }, (_, index) => ({ x: index, y: referenceHz * 2 ** (index / 12), series: "12-EDO reference" })),
    visualKind: "pitch",
    annotation: "The calculation fixes a reference frequency; pitch spelling, function, and preference are outside it.",
    traceAxes: axes("Equal-temperament step", "semitones", "Frequency", "Hz"),
  });
}

export function evaluateTemperamentsAndCommas(factors: Factors): EvaluationOutput {
  const divisions = Math.round(readNumber(factors, "divisions"));
  const ratio = readNumber(factors, "numerator") / readNumber(factors, "denominator");
  const referenceHz = readNumber(factors, "referenceHz");
  const steps = nearestEdoSteps(ratio, divisions);
  const approximation = edoStepsToRatio(steps, divisions);
  const error = ratioToCents(approximation / ratio);
  const beating = beatingRateHz(referenceHz * ratio, referenceHz * approximation);
  return result({
    headline: "Temperament approximation",
    result: `${steps} steps of ${divisions}-EDO; ${signed(error, 2)} cents`,
    observables: [
      observable({ id: "steps", label: "Nearest EDO steps", value: steps, unit: null, claimId: "math.identity", precision: 0 }),
      observable({ id: "approximation", label: "Approximating ratio", value: approximation, unit: null, claimId: "math.identity", precision: 6 }),
      observable({ id: "centsError", label: "Signed cents error", value: error, unit: "cents", claimId: "math.identity", precision: 2 }),
      observable({ id: "beating", label: "Idealized frequency separation", value: beating, unit: "Hz", claimId: "heuristic.transparent", precision: 2 }),
    ],
    trace: Array.from({ length: divisions + 1 }, (_, index) => ({ x: index, y: edoStepsToRatio(index, divisions), series: `${divisions}-EDO` })),
    visualKind: "pitch",
    annotation: "Frequency separation is an ideal beating proxy; instrument spectra and listening context change the experience.",
    traceAxes: axes("EDO step", "steps", "Frequency ratio", null),
  });
}

export function evaluateTimbreChangesConsonance(factors: Factors): EvaluationOutput {
  const intervalCents = readNumber(factors, "intervalCents");
  const partialCount = Math.round(readNumber(factors, "partialCount"));
  const rolloff = readNumber(factors, "rolloff");
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
  return result({
    headline: "Transparent spectral proxies",
    result: `${coincidence.toFixed(2)} weighted partial coincidence`,
    observables: [
      observable({ id: "coincidence", label: "Weighted partial coincidence", value: coincidence, unit: null, claimId: "heuristic.transparent", precision: 2 }),
      observable({ id: "roughness", label: "Pairwise roughness proxy", value: roughnessProxy, unit: null, claimId: "heuristic.transparent", precision: 2 }),
      observable({ id: "ratio", label: "Fundamental ratio", value: ratio, unit: null, claimId: "math.identity", precision: 5 }),
    ],
    trace,
    visualKind: "spectrum",
    annotation: "These proxies support within-model comparison only; they do not score consonance or preference.",
    traceAxes: axes("Partial frequency ratio", null, "Partial amplitude", null),
  });
}
