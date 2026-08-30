import {
  bpmToPeriodSeconds,
  circularPhaseDifference,
  greatestCommonDivisor,
  leastCommonMultiple,
  phaseAtTime,
} from "./model";
import { axes, numberFactor, observableValues as observable, resultValues as result } from "../support/evaluation";
import type { EvaluationOutput, FactorValue, TracePoint } from "../../curriculum/contracts";

type Factors = Readonly<Record<string, FactorValue>>;

export function evaluateFromBpmToPeriod(factors: Factors): EvaluationOutput {
  const bpm = numberFactor(factors, "bpm");
  const beatsPerBar = numberFactor(factors, "beatsPerBar");
  const period = bpmToPeriodSeconds(bpm);
  const bar = period * beatsPerBar;
  const trace = Array.from({ length: 16 }, (_, index) => {
    const x = 30 + index * 14;
    return { x, y: bpmToPeriodSeconds(x), series: "Seconds per beat" };
  });
  return result(
    "Mathematical result",
    `${period.toFixed(3)} seconds per beat`,
    [
      observable("period", "Beat period", period, "s", "math.identity", 3),
      observable("barDuration", "Bar duration", bar, "s", "math.identity", 3),
      observable("inverseTempo", "Inverse check", 60 / period, "BPM", "math.identity", 1),
    ],
    trace,
    "pulse",
    "The curve is an exact inverse relationship. A performed beat may vary around the notated tempo.",
    axes("Tempo", "BPM", "Beat period", "s"),
  );
}

export function evaluatePolyrhythmReturnTimes(factors: Factors): EvaluationOutput {
  const pulseA = Math.round(numberFactor(factors, "pulseA"));
  const pulseB = Math.round(numberFactor(factors, "pulseB"));
  const bpm = numberFactor(factors, "bpm");
  const lcm = leastCommonMultiple(pulseA, pulseB);
  const gcd = greatestCommonDivisor(pulseA, pulseB);
  const sharedCycleSeconds = bpmToPeriodSeconds(bpm);
  const trace: TracePoint[] = [];
  for (let index = 0; index <= pulseA; index += 1) {
    trace.push({ x: (index * lcm) / pulseA, y: 1, series: `Layer A (${pulseA} pulses / shared cycle)` });
  }
  for (let index = 0; index <= pulseB; index += 1) {
    trace.push({ x: (index * lcm) / pulseB, y: 0, series: `Layer B (${pulseB} pulses / shared cycle)` });
  }
  return result(
    "Mathematical result",
    `${pulseA}:${pulseB} uses a ${lcm}-subdivision lattice within one shared cycle`,
    [
      observable("gcd", "Common pulse-count divisor", gcd, null, "math.identity", 0),
      observable("lcm", "Onset-lattice resolution", lcm, "subdivisions / shared cycle", "math.identity", 0),
      observable("realignment", "Exact realignment", 1, "shared cycle", "math.identity", 0),
      observable("returnSeconds", "Shared-cycle duration at reference tempo", sharedCycleSeconds, "s", "math.identity", 3),
    ],
    trace,
    "pulse",
    `The trace runs from lattice step 0 to ${lcm}: both layers align at the shared-cycle endpoints, not after ${lcm} beats. Accent and perceived meter are not computed.`,
    axes("Onset-lattice step", "subdivisions / shared cycle", "Layer position", null),
  );
}

export function evaluatePhaseOnTheCircle(factors: Factors): EvaluationOutput {
  const periodA = numberFactor(factors, "periodA");
  const periodB = numberFactor(factors, "periodB");
  const elapsed = numberFactor(factors, "elapsed");
  const offset = numberFactor(factors, "offset");
  const phaseA = phaseAtTime(elapsed, periodA);
  const phaseB = phaseAtTime(elapsed, periodB) + offset;
  const wrappedB = ((phaseB % 1) + 1) % 1;
  const difference = circularPhaseDifference(phaseA, wrappedB);
  return result(
    "Circular state",
    `${Math.abs(difference).toFixed(3)} cycles apart`,
    [
      observable("phaseA", "Phase A", phaseA, "cycles", "math.identity", 3),
      observable("phaseB", "Phase B", wrappedB, "cycles", "math.identity", 3),
      observable("phaseDifference", "Shortest signed difference", difference, "cycles", "math.identity", 3),
    ],
    [
      { x: phaseA, y: 1, series: "Phase A" },
      { x: wrappedB, y: 1, series: "Phase B" },
    ],
    "phase",
    "Positive difference means B is ahead along the chosen circular orientation.",
    axes("Phase position", "cycles", "Radial marker", null),
  );
}
