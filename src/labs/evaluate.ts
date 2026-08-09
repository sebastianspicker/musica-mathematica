import {
  circularPhaseDifference,
  greatestCommonDivisor,
  leastCommonMultiple,
  phaseAtTime,
  bpmToPeriodSeconds,
} from "./phase-proportion/model";
import {
  analyzeRhythm,
  euclideanRhythm,
  rankMeterCandidates,
  rotateRhythm,
} from "./rhythm-meter/model";
import {
  beatingRateHz,
  centsToRatio,
  edoStepsToRatio,
  nearestEdoSteps,
  ratioToCents,
} from "./pitch-tuning/model";
import { defaultConfig } from "../simulation/presets";
import { simulateEnsemble, type EnsembleConfig, type Topology } from "../simulation/ensemble";
import {
  evaluateAliasing,
  evaluateChordHypotheses,
  evaluateDescriptiveComparison,
  evaluateInformation,
  evaluateMarkov,
  evaluateParameterRecovery,
  evaluatePitchClass,
  evaluateResonance,
  evaluateSeededChance,
  evaluateTimeVaryingTimbre,
  evaluateUncertainty,
  evaluateVoiceLeading,
} from "./evaluateAdvanced";
import {
  axes,
  numberFactor,
  observableValues as observable,
  resultValues as result,
  signed,
  stringFactor,
  SYNTHETIC_PROVENANCE,
} from "./evaluationSupport";
import type { FactorValue, LabEvaluation, LabLesson, TracePoint } from "./types";

export function evaluateLesson(
  lesson: LabLesson,
  factors: Readonly<Record<string, FactorValue>>,
): LabEvaluation {
  switch (lesson.id) {
    case "from-bpm-to-period":
      return evaluateBpm(factors);
    case "polyrhythm-return-times":
      return evaluatePolyrhythm(factors);
    case "phase-on-the-circle":
      return evaluateCircularPhase(factors);
    case "lock-in-and-order":
    case "delay-jitter-topology":
    case "external-pulse-or-peer-adaptation":
      return evaluateEnsemble(lesson.id, factors);
    case "cycles-and-euclidean-rhythm":
    case "autocorrelation-spectrum-meter":
      return evaluatePattern(lesson.id, factors);
    case "recorded-onset-hypotheses":
      return evaluateOnsetHypotheses(factors);
    case "ratios-logs-cents":
      return evaluateRatio(factors);
    case "temperaments-and-commas":
      return evaluateTemperament(factors);
    case "timbre-changes-consonance":
      return evaluateTimbreConsonance(factors);
    case "pitch-class-symmetry":
      return evaluatePitchClass(factors);
    case "tonnetz-and-voice-leading":
      return evaluateVoiceLeading(factors);
    case "chord-hypotheses":
      return evaluateChordHypotheses(factors);
    case "resonance-modes-partials":
      return evaluateResonance(factors);
    case "fourier-windows-aliasing":
      return evaluateAliasing(factors);
    case "time-varying-timbre":
      return evaluateTimeVaryingTimbre(factors);
    case "seeded-chance":
      return evaluateSeededChance(factors);
    case "markov-memory":
      return evaluateMarkov(factors);
    case "entropy-surprisal-form":
      return evaluateInformation(factors);
    case "provenance-and-uncertainty":
      return evaluateUncertainty(factors);
    case "recovering-parameters":
      return evaluateParameterRecovery(factors);
    case "compare-without-grading":
      return evaluateDescriptiveComparison(factors);
    default:
      throw new RangeError(`No evaluator is registered for lesson ${lesson.id}.`);
  }
}

function evaluateBpm(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
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

function evaluatePolyrhythm(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
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

function evaluateCircularPhase(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
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

function evaluateEnsemble(
  lessonId: string,
  factors: Readonly<Record<string, FactorValue>>,
): LabEvaluation {
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

function safePattern(factors: Readonly<Record<string, FactorValue>>): number[] {
  const steps = Math.max(1, Math.round(numberFactor(factors, "steps")));
  const pulses = Math.min(steps, Math.max(0, Math.round(numberFactor(factors, "pulses"))));
  const rotation = Math.round(numberFactor(factors, "rotation"));
  return rotateRhythm(euclideanRhythm(pulses, steps), rotation);
}

function evaluatePattern(
  lessonId: string,
  factors: Readonly<Record<string, FactorValue>>,
): LabEvaluation {
  const pattern = safePattern(factors);
  const analysis = analyzeRhythm(pattern);
  const trace = pattern.map((value, index) => ({ x: index, y: value, series: "Onset pattern" }));
  if (lessonId === "cycles-and-euclidean-rhythm") {
    return result(
      "Cyclic onset vector",
      pattern.join(" "),
      [
        observable("onsets", "Onset count", analysis.pulseCount, null, "math.identity", 0),
        observable("density", "Onset density", analysis.density, null, "math.identity", 3),
        observable("cycleLength", "Cycle length", pattern.length, "steps", "math.identity", 0),
      ],
      trace,
      "pulse",
      "Rotation preserves onset count and density while relocating the chosen cycle origin.",
      axes("Cycle step", "steps", "Onset indicator", null),
    );
  }
  const meters = rankMeterCandidates(pattern);
  const strongestSpectrum = analysis.spectrum.slice(1).sort((a, b) => b.magnitude - a.magnitude)[0];
  const topMeter = meters[0];
  const profileTrace = analysis.autocorrelation.map((value, index) => ({
    x: index,
    y: value,
    series: "Circular autocorrelation",
  }));
  return result(
    "Ranked periodicity",
    `${topMeter.beats} beats × ${topMeter.subdivisionsPerBeat} subdivisions`,
    [
      observable("topMeter", "Top equal-subdivision candidate", `${topMeter.beats} × ${topMeter.subdivisionsPerBeat}`, null, "heuristic.transparent"),
      observable("meterScore", "Onset-alignment score", topMeter.score, null, "heuristic.transparent", 3),
      observable("spectralBin", "Strongest non-DC bin", strongestSpectrum.bin, null, "model.deterministic", 0),
    ],
    profileTrace,
    "spectrum",
    "The ranking describes this vector under one candidate family; it is not a definitive heard meter.",
    axes("Circular lag", "steps", "Autocorrelation", null),
  );
}

function evaluateOnsetHypotheses(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
  const tempo = numberFactor(factors, "tempoBpm");
  const threshold = numberFactor(factors, "threshold");
  const bias = stringFactor(factors, "meterBias");
  const eventCount = Math.max(2, Math.round(12 * (1.05 - threshold)));
  const candidates = bias === "duple" ? [tempo, tempo / 2, tempo * 2] : bias === "triple" ? [tempo, tempo * 1.5, tempo / 2] : [tempo, tempo / 2, tempo * 1.5];
  const trace = Array.from({ length: eventCount }, (_, index) => ({
    x: index * (60 / tempo),
    y: 0.65 + 0.25 * Math.sin(index * 1.7),
    series: "Detected onset strength",
  }));
  return result(
    "Ranked transcription hypotheses",
    `${candidates[0].toFixed(1)} BPM (top candidate)`,
    [
      observable("onsetCount", "Events above threshold", eventCount, null, "hypothesis.transcription", 0),
      observable("tempo1", "Tempo candidate 1", candidates[0], "BPM", "hypothesis.transcription", 1),
      observable("tempo2", "Tempo candidate 2", candidates[1], "BPM", "hypothesis.transcription", 1),
      observable("tempo3", "Tempo candidate 3", candidates[2], "BPM", "hypothesis.transcription", 1),
    ],
    trace,
    "spectrum",
    "Synthetic fixture shown. Microphone and file modes must retain the same hypothesis wording and local-only boundary.",
    axes("Time", "s", "Onset strength", null),
    SYNTHETIC_PROVENANCE,
  );
}

function evaluateRatio(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
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

function evaluateTemperament(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
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

function evaluateTimbreConsonance(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
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
