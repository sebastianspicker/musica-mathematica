import { defaultConfig } from "./defaultConfig";
import { simulateEnsemble, type EnsembleConfig, type Topology } from "./ensemble";
import { axes, numberFactor, observableValues as observable, resultValues as result, stringFactor } from "../support/evaluation";
import type { EvaluationOutput, FactorValue } from "../../curriculum/contracts";

type Factors = Readonly<Record<string, FactorValue>>;

export function evaluateLockInAndOrder(factors: Factors): EvaluationOutput {
  return evaluateEnsemble("lock-in-and-order", factors);
}

export function evaluateDelayJitterTopology(factors: Factors): EvaluationOutput {
  return evaluateEnsemble("delay-jitter-topology", factors);
}

export function evaluateExternalPulseOrPeerAdaptation(factors: Factors): EvaluationOutput {
  return evaluateEnsemble("external-pulse-or-peer-adaptation", factors);
}

function evaluateEnsemble(lessonId: string, factors: Factors): EvaluationOutput {
  const config: EnsembleConfig = { ...defaultConfig };
  if (lessonId === "lock-in-and-order") {
    config.musicianCount = Math.round(numberFactor(factors, "musicianCount"));
    config.tempoBpm = numberFactor(factors, "tempoBpm");
    config.tempoSpreadBpm = numberFactor(factors, "tempoSpreadBpm");
    config.couplingStrength = numberFactor(factors, "couplingStrength");
    config.latencySeconds = 0.012;
  } else if (lessonId === "delay-jitter-topology") {
    config.latencySeconds = numberFactor(factors, "latencyMs") / 1000;
    config.jitterSeconds = numberFactor(factors, "jitterMs") / 1000;
    config.couplingStrength = numberFactor(factors, "couplingStrength");
    config.topology = stringFactor(factors, "topology") as Topology;
    config.repertoireTexture = "dense-rhythm";
  } else {
    config.clickTrackStrength = numberFactor(factors, "clickTrackStrength");
    config.couplingStrength = numberFactor(factors, "couplingStrength");
    config.tempoSpreadBpm = numberFactor(factors, "tempoSpreadBpm");
    config.tempoBpm = numberFactor(factors, "tempoBpm");
    config.topology = "click-track";
  }
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
  return result(
    "Terminal model state",
    `r = ${metrics.coherence.toFixed(3)}`,
    [
      observable("coherence", "Order parameter", metrics.coherence, null, "model.ensemble", 3, "terminal-mean"),
      observable("phaseSpread", "Circular phase spread", metrics.phaseSpread, "rad", "model.ensemble", 3, "terminal-mean"),
      observable("phaseSpreadEquivalent", "Period-equivalent spread", metrics.phaseSpreadEquivalentMs, "ms", "model.ensemble", 1, "terminal-mean"),
      observable("peerShare", "Peer-coupling share", metrics.peerCouplingShare, null, "heuristic.transparent", 2),
    ],
    trace,
    "network",
    "Eight deterministic model seconds; values are simulated, not measured from performers or a network.",
    axes("Model time", "s", "Normalized ensemble state", null),
  );
}
