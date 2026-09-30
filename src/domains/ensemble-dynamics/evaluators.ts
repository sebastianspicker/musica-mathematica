import { defaultConfig, type EnsembleConfig, type Topology } from "./config";
import { simulateEnsemble } from "./model";
import { axes, observable, readNumber, readString, result } from "../support/evaluation";
import type { EvaluationOutput, FactorValue } from "../../curriculum/contracts";

type Factors = Readonly<Record<string, FactorValue>>;

export function evaluateLockInAndOrder(factors: Factors): EvaluationOutput {
  return evaluateEnsemble({
    ...defaultConfig,
    musicianCount: Math.round(readNumber(factors, "musicianCount")),
    tempoBpm: readNumber(factors, "tempoBpm"),
    tempoSpreadBpm: readNumber(factors, "tempoSpreadBpm"),
    couplingStrength: readNumber(factors, "couplingStrength"),
    latencySeconds: 0.012,
  });
}

export function evaluateDelayJitterTopology(factors: Factors): EvaluationOutput {
  return evaluateEnsemble({
    ...defaultConfig,
    latencySeconds: readNumber(factors, "latencyMs") / 1000,
    jitterSeconds: readNumber(factors, "jitterMs") / 1000,
    couplingStrength: readNumber(factors, "couplingStrength"),
    topology: readString(factors, "topology") as Topology,
    repertoireTexture: "dense-rhythm",
  });
}

export function evaluateExternalPulseOrPeerAdaptation(factors: Factors): EvaluationOutput {
  return evaluateEnsemble({
    ...defaultConfig,
    clickTrackStrength: readNumber(factors, "clickTrackStrength"),
    couplingStrength: readNumber(factors, "couplingStrength"),
    tempoSpreadBpm: readNumber(factors, "tempoSpreadBpm"),
    tempoBpm: readNumber(factors, "tempoBpm"),
    topology: "click-track",
  });
}

function evaluateEnsemble(config: EnsembleConfig): EvaluationOutput {
  const simulation = simulateEnsemble(config, 8);
  const metrics = simulation.finalMetrics;
  const stride = Math.max(1, Math.ceil(simulation.samples.length / 96));
  const trace = simulation.samples.flatMap((sample, index) => {
    if (index % stride !== 0 && index !== simulation.samples.length - 1) return [];
    return [
      { x: sample.state.time, y: sample.metrics.coherence, series: "Coherence" },
      { x: sample.state.time, y: sample.metrics.phaseSpread / Math.PI, series: "Phase spread / pi" },
    ];
  });
  return result({
    headline: "Terminal model state",
    result: `r = ${metrics.coherence.toFixed(3)}`,
    observables: [
      observable({ id: "coherence", label: "Order parameter", value: metrics.coherence, unit: null, claimId: "model.ensemble", precision: 3, aggregation: "terminal-mean" }),
      observable({ id: "phaseSpread", label: "Circular phase spread", value: metrics.phaseSpread, unit: "rad", claimId: "model.ensemble", precision: 3, aggregation: "terminal-mean" }),
      observable({ id: "phaseSpreadEquivalent", label: "Period-equivalent spread", value: metrics.phaseSpreadEquivalentMs, unit: "ms", claimId: "model.ensemble", precision: 1, aggregation: "terminal-mean" }),
      observable({ id: "peerShare", label: "Peer-coupling share", value: metrics.peerCouplingShare, unit: null, claimId: "heuristic.transparent", precision: 2 }),
    ],
    trace,
    visualKind: "network",
    annotation: "Eight deterministic model seconds; values are simulated, not measured from performers or a network.",
    traceAxes: axes("Model time", "s", "Normalized ensemble state", null),
  });
}
