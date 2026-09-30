import {
  bpmToPeriodSeconds,
  circularPhaseDifference,
  greatestCommonDivisor,
  leastCommonMultiple,
  phaseAtTime,
} from "./model";
import { axes, readNumber, observable, result } from "../support/evaluation";
import type { EvaluationOutput, FactorValue, TracePoint } from "../../curriculum/contracts";

type Factors = Readonly<Record<string, FactorValue>>;

export function evaluateFromBpmToPeriod(factors: Factors): EvaluationOutput {
  const bpm = readNumber(factors, "bpm");
  const beatsPerBar = readNumber(factors, "beatsPerBar");
  const period = bpmToPeriodSeconds(bpm);
  const bar = period * beatsPerBar;
  const trace = Array.from({ length: 16 }, (_, index) => {
    const x = 30 + index * 14;
    return { x, y: bpmToPeriodSeconds(x), series: "Seconds per beat" };
  });
  return result({
    headline: "Mathematical result",
    result: `${period.toFixed(3)} seconds per beat`,
    observables: [
      observable({ id: "period", label: "Beat period", value: period, unit: "s", claimId: "math.identity", precision: 3 }),
      observable({ id: "barDuration", label: "Bar duration", value: bar, unit: "s", claimId: "math.identity", precision: 3 }),
      observable({ id: "inverseTempo", label: "Inverse check", value: 60 / period, unit: "BPM", claimId: "math.identity", precision: 1 }),
    ],
    trace,
    visualKind: "pulse",
    annotation: "The curve is an exact inverse relationship. A performed beat may vary around the notated tempo.",
    traceAxes: axes("Tempo", "BPM", "Beat period", "s"),
  });
}

export function evaluatePolyrhythmReturnTimes(factors: Factors): EvaluationOutput {
  const pulseA = Math.round(readNumber(factors, "pulseA"));
  const pulseB = Math.round(readNumber(factors, "pulseB"));
  const bpm = readNumber(factors, "bpm");
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
  return result({
    headline: "Mathematical result",
    result: `${pulseA}:${pulseB} uses a ${lcm}-subdivision lattice within one shared cycle`,
    observables: [
      observable({ id: "gcd", label: "Common pulse-count divisor", value: gcd, unit: null, claimId: "math.identity", precision: 0 }),
      observable({ id: "lcm", label: "Onset-lattice resolution", value: lcm, unit: "subdivisions / shared cycle", claimId: "math.identity", precision: 0 }),
      observable({ id: "realignment", label: "Exact realignment", value: 1, unit: "shared cycle", claimId: "math.identity", precision: 0 }),
      observable({ id: "returnSeconds", label: "Shared-cycle duration at reference tempo", value: sharedCycleSeconds, unit: "s", claimId: "math.identity", precision: 3 }),
    ],
    trace,
    visualKind: "pulse",
    annotation: `The trace runs from lattice step 0 to ${lcm}: both layers align at the shared-cycle endpoints, not after ${lcm} beats. Accent and perceived meter are not computed.`,
    traceAxes: axes("Onset-lattice step", "subdivisions / shared cycle", "Layer position", null),
  });
}

export function evaluatePhaseOnTheCircle(factors: Factors): EvaluationOutput {
  const periodA = readNumber(factors, "periodA");
  const periodB = readNumber(factors, "periodB");
  const elapsed = readNumber(factors, "elapsed");
  const offset = readNumber(factors, "offset");
  const phaseA = phaseAtTime(elapsed, periodA);
  const phaseB = phaseAtTime(elapsed, periodB) + offset;
  const wrappedB = ((phaseB % 1) + 1) % 1;
  const difference = circularPhaseDifference(phaseA, wrappedB);
  return result({
    headline: "Circular state",
    result: `${Math.abs(difference).toFixed(3)} cycles apart`,
    observables: [
      observable({ id: "phaseA", label: "Phase A", value: phaseA, unit: "cycles", claimId: "math.identity", precision: 3 }),
      observable({ id: "phaseB", label: "Phase B", value: wrappedB, unit: "cycles", claimId: "math.identity", precision: 3 }),
      observable({ id: "phaseDifference", label: "Shortest signed difference", value: difference, unit: "cycles", claimId: "math.identity", precision: 3 }),
    ],
    trace: [
      { x: phaseA, y: 1, series: "Phase A" },
      { x: wrappedB, y: 1, series: "Phase B" },
    ],
    visualKind: "phase",
    annotation: "Positive difference means B is ahead along the chosen circular orientation.",
    traceAxes: axes("Phase position", "cycles", "Radial marker", null),
  });
}
