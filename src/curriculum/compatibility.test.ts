import { describe, expect, it } from "vitest";
import { curriculumCatalog } from "./catalog";
import type { FactorDefinition } from "./contracts";

const compatibilityManifest = [
  {
    id: "phase-proportion",
    lessons: [
      {
        id: "from-bpm-to-period",
        protocolId: "phase-proportion.from-bpm-to-period.v1",
        factorIds: ["bpm", "beatsPerBar"],
        factors: [
          { id: "bpm", kind: "number", min: 30, max: 240, step: 1 },
          { id: "beatsPerBar", kind: "number", min: 1, max: 12, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["snyder-2024"],
      },
      {
        id: "polyrhythm-return-times",
        protocolId: "phase-proportion.polyrhythm-return-times.v1",
        factorIds: ["pulseA", "pulseB", "bpm"],
        factors: [
          { id: "pulseA", kind: "number", min: 1, max: 12, step: 1 },
          { id: "pulseB", kind: "number", min: 1, max: 12, step: 1 },
          { id: "bpm", kind: "number", min: 30, max: 180, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["jacoby-2024", "snyder-2024"],
      },
      {
        id: "phase-on-the-circle",
        protocolId: "phase-proportion.phase-on-the-circle.v1",
        factorIds: ["periodA", "periodB", "elapsed", "offset"],
        factors: [
          { id: "periodA", kind: "number", min: 0.2, max: 4, step: 0.05 },
          { id: "periodB", kind: "number", min: 0.2, max: 4, step: 0.05 },
          { id: "elapsed", kind: "number", min: 0, max: 16, step: 0.1 },
          { id: "offset", kind: "number", min: -0.5, max: 0.5, step: 0.01 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["snyder-2024"],
      },
    ],
  },
  {
    id: "ensemble-dynamics",
    lessons: [
      {
        id: "lock-in-and-order",
        protocolId: "ensemble-dynamics.lock-in-and-order.v1",
        factorIds: ["musicianCount", "tempoBpm", "tempoSpreadBpm", "couplingStrength"],
        factors: [
          { id: "musicianCount", kind: "number", min: 2, max: 24, step: 1 },
          { id: "tempoBpm", kind: "number", min: 40, max: 220, step: 1 },
          { id: "tempoSpreadBpm", kind: "number", min: 0, max: 30, step: 0.5 },
          { id: "couplingStrength", kind: "number", min: 0, max: 4, step: 0.05 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["model.ensemble", "heuristic.transparent", "literature.context", "recommendation.inquiry"],
        sourceIds: ["demos-palmer-2023", "abalde-2024"],
      },
      {
        id: "delay-jitter-topology",
        protocolId: "ensemble-dynamics.delay-jitter-topology.v1",
        factorIds: ["latencyMs", "jitterMs", "couplingStrength", "topology"],
        factors: [
          { id: "latencyMs", kind: "number", min: 0, max: 250, step: 1 },
          { id: "jitterMs", kind: "number", min: 0, max: 80, step: 1 },
          { id: "couplingStrength", kind: "number", min: 0, max: 4, step: 0.05 },
          { id: "topology", kind: "select", options: ["all-to-all", "leader-follower", "sections"] },
        ],
        inputModes: ["synthetic"],
        claimIds: ["model.ensemble", "heuristic.transparent", "literature.context", "recommendation.inquiry"],
        sourceIds: ["demos-palmer-2023", "abalde-2024"],
      },
      {
        id: "external-pulse-or-peer-adaptation",
        protocolId: "ensemble-dynamics.external-pulse-or-peer-adaptation.v1",
        factorIds: ["clickTrackStrength", "couplingStrength", "tempoSpreadBpm", "tempoBpm"],
        factors: [
          { id: "clickTrackStrength", kind: "number", min: 0, max: 4, step: 0.05 },
          { id: "couplingStrength", kind: "number", min: 0, max: 4, step: 0.05 },
          { id: "tempoSpreadBpm", kind: "number", min: 0, max: 30, step: 0.5 },
          { id: "tempoBpm", kind: "number", min: 40, max: 220, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["model.ensemble", "heuristic.transparent", "literature.context", "recommendation.inquiry"],
        sourceIds: ["demos-palmer-2023", "abalde-2024"],
      },
    ],
  },
  {
    id: "rhythm-meter",
    lessons: [
      {
        id: "cycles-and-euclidean-rhythm",
        protocolId: "rhythm-meter.cycles-and-euclidean-rhythm.v1",
        factorIds: ["steps", "pulses", "rotation"],
        factors: [
          { id: "steps", kind: "number", min: 4, max: 32, step: 1 },
          { id: "pulses", kind: "number", min: 0, max: 16, step: 1 },
          { id: "rotation", kind: "number", min: -16, max: 16, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["jacoby-2024", "snyder-2024"],
      },
      {
        id: "autocorrelation-spectrum-meter",
        protocolId: "rhythm-meter.autocorrelation-spectrum-meter.v1",
        factorIds: ["steps", "pulses", "rotation"],
        factors: [
          { id: "steps", kind: "number", min: 4, max: 32, step: 1 },
          { id: "pulses", kind: "number", min: 1, max: 12, step: 1 },
          { id: "rotation", kind: "number", min: -12, max: 12, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry", "heuristic.transparent"],
        sourceIds: ["jacoby-2024", "snyder-2024"],
      },
      {
        id: "recorded-onset-hypotheses",
        protocolId: "rhythm-meter.recorded-onset-hypotheses.v1",
        factorIds: ["tempoBpm", "threshold", "meterBias"],
        factors: [
          { id: "tempoBpm", kind: "number", min: 40, max: 220, step: 1 },
          { id: "threshold", kind: "number", min: 0.05, max: 0.95, step: 0.05, audioSetting: "onsetSensitivity" },
          { id: "meterBias", kind: "select", options: ["mixed", "duple", "triple"], audioSetting: "meterBias" },
        ],
        inputModes: ["synthetic", "microphone", "file"],
        claimIds: ["measurement.local", "hypothesis.transcription", "literature.context", "recommendation.inquiry"],
        sourceIds: ["jacoby-2024", "snyder-2024", "w3c-webaudio", "w3c-mediacapture"],
      },
    ],
  },
  {
    id: "pitch-tuning",
    lessons: [
      {
        id: "ratios-logs-cents",
        protocolId: "pitch-tuning.ratios-logs-cents.v1",
        factorIds: ["numerator", "denominator", "referenceHz"],
        factors: [
          { id: "numerator", kind: "number", min: 1, max: 16, step: 1 },
          { id: "denominator", kind: "number", min: 1, max: 16, step: 1 },
          { id: "referenceHz", kind: "number", min: 40, max: 880, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["marjieh-2024"],
      },
      {
        id: "temperaments-and-commas",
        protocolId: "pitch-tuning.temperaments-and-commas.v1",
        factorIds: ["divisions", "numerator", "denominator", "referenceHz"],
        factors: [
          { id: "divisions", kind: "number", min: 5, max: 53, step: 1 },
          { id: "numerator", kind: "number", min: 1, max: 16, step: 1 },
          { id: "denominator", kind: "number", min: 1, max: 16, step: 1 },
          { id: "referenceHz", kind: "number", min: 40, max: 880, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry", "heuristic.transparent"],
        sourceIds: ["marjieh-2024"],
      },
      {
        id: "timbre-changes-consonance",
        protocolId: "pitch-tuning.timbre-changes-consonance.v1",
        factorIds: ["intervalCents", "partialCount", "rolloff"],
        factors: [
          { id: "intervalCents", kind: "number", min: 0, max: 1200, step: 5 },
          { id: "partialCount", kind: "number", min: 1, max: 24, step: 1 },
          { id: "rolloff", kind: "number", min: 0.2, max: 3, step: 0.1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "heuristic.transparent", "recommendation.inquiry"],
        sourceIds: ["marjieh-2024"],
      },
    ],
  },
  {
    id: "harmony-geometry",
    lessons: [
      {
        id: "pitch-class-symmetry",
        protocolId: "harmony-geometry.pitch-class-symmetry.v1",
        factorIds: ["set", "axis", "invert"],
        factors: [
          { id: "set", kind: "select", options: ["major", "minor", "quartal", "whole-tone"] },
          { id: "axis", kind: "number", min: 0, max: 11, step: 1 },
          { id: "invert", kind: "toggle" },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["frederick-2023"],
      },
      {
        id: "tonnetz-and-voice-leading",
        protocolId: "harmony-geometry.tonnetz-and-voice-leading.v1",
        factorIds: ["chordA", "chordB", "metric"],
        factors: [
          { id: "chordA", kind: "select", options: ["C", "G", "F", "Am", "Em", "Dm"] },
          { id: "chordB", kind: "select", options: ["C", "G", "F", "Am", "Em", "Dm"] },
          { id: "metric", kind: "select", options: ["tonnetz", "chromatic"] },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry", "heuristic.transparent"],
        sourceIds: ["frederick-2023"],
      },
      {
        id: "chord-hypotheses",
        protocolId: "harmony-geometry.chord-hypotheses.v1",
        factorIds: ["root", "quality", "ambiguity"],
        factors: [
          { id: "root", kind: "number", min: 0, max: 11, step: 1 },
          { id: "quality", kind: "select", options: ["major", "minor"] },
          { id: "ambiguity", kind: "number", min: 0, max: 1, step: 0.05 },
        ],
        inputModes: ["synthetic", "microphone", "file"],
        claimIds: ["measurement.local", "hypothesis.transcription", "heuristic.transparent", "recommendation.inquiry"],
        sourceIds: ["w3c-webaudio"],
      },
    ],
  },
  {
    id: "timbre-acoustics",
    lessons: [
      {
        id: "resonance-modes-partials",
        protocolId: "timbre-acoustics.resonance-modes-partials.v1",
        factorIds: ["length", "waveSpeed", "partialCount"],
        factors: [
          { id: "length", kind: "number", min: 0.2, max: 2, step: 0.01 },
          { id: "waveSpeed", kind: "number", min: 40, max: 500, step: 1 },
          { id: "partialCount", kind: "number", min: 1, max: 24, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["marjieh-2024"],
      },
      {
        id: "fourier-windows-aliasing",
        protocolId: "timbre-acoustics.fourier-windows-aliasing.v1",
        factorIds: ["frequencyHz", "sampleRateHz", "frameSize"],
        factors: [
          { id: "frequencyHz", kind: "number", min: 20, max: 30000, step: 10 },
          { id: "sampleRateHz", kind: "select", options: ["22050", "44100", "48000"] },
          { id: "frameSize", kind: "select", options: ["2048", "4096"] },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["w3c-webaudio"],
      },
      {
        id: "time-varying-timbre",
        protocolId: "timbre-acoustics.time-varying-timbre.v1",
        factorIds: ["attackMs", "decayMs", "modulationHz", "modulationDepth"],
        factors: [
          { id: "attackMs", kind: "number", min: 5, max: 1000, step: 5 },
          { id: "decayMs", kind: "number", min: 100, max: 4000, step: 25 },
          { id: "modulationHz", kind: "number", min: 0, max: 12, step: 0.25 },
          { id: "modulationDepth", kind: "number", min: 0, max: 1, step: 0.05 },
        ],
        inputModes: ["synthetic", "microphone", "file"],
        claimIds: ["model.deterministic", "measurement.local", "literature.context", "heuristic.transparent"],
        sourceIds: ["marjieh-2024", "w3c-webaudio"],
      },
    ],
  },
  {
    id: "probability-form",
    lessons: [
      {
        id: "seeded-chance",
        protocolId: "probability-form.seeded-chance.v1",
        factorIds: ["probability", "length", "seed"],
        factors: [
          { id: "probability", kind: "number", min: 0.05, max: 0.95, step: 0.05 },
          { id: "length", kind: "number", min: 4, max: 128, step: 1 },
          { id: "seed", kind: "number", min: 0, max: 9999, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: [],
      },
      {
        id: "markov-memory",
        protocolId: "probability-form.markov-memory.v1",
        factorIds: ["stayProbability", "length", "seed"],
        factors: [
          { id: "stayProbability", kind: "number", min: 0.05, max: 0.95, step: 0.05 },
          { id: "length", kind: "number", min: 4, max: 128, step: 1 },
          { id: "seed", kind: "number", min: 0, max: 9999, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: [],
      },
      {
        id: "entropy-surprisal-form",
        protocolId: "probability-form.entropy-surprisal-form.v1",
        factorIds: ["probability", "length", "seed"],
        factors: [
          { id: "probability", kind: "number", min: 0.05, max: 0.95, step: 0.05 },
          { id: "length", kind: "number", min: 4, max: 128, step: 1 },
          { id: "seed", kind: "number", min: 0, max: 9999, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry", "heuristic.transparent"],
        sourceIds: [],
      },
    ],
  },
  {
    id: "measurement-inference",
    lessons: [
      {
        id: "provenance-and-uncertainty",
        protocolId: "measurement-inference.provenance-and-uncertainty.v1",
        factorIds: ["sampleCount", "trueValue", "noise", "seed"],
        factors: [
          { id: "sampleCount", kind: "number", min: 4, max: 256, step: 1 },
          { id: "trueValue", kind: "number", min: 0, max: 200, step: 1 },
          { id: "noise", kind: "number", min: 0, max: 40, step: 0.5 },
          { id: "seed", kind: "number", min: 0, max: 9999, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["model.deterministic", "measurement.local", "heuristic.transparent", "recommendation.inquiry"],
        sourceIds: ["w3c-webaudio", "w3c-mediacapture"],
      },
      {
        id: "recovering-parameters",
        protocolId: "measurement-inference.recovering-parameters.v1",
        factorIds: ["tempoBpm", "jitterMs", "sampleCount", "seed"],
        factors: [
          { id: "tempoBpm", kind: "number", min: 40, max: 220, step: 1 },
          { id: "jitterMs", kind: "number", min: 0, max: 120, step: 1 },
          { id: "sampleCount", kind: "number", min: 6, max: 128, step: 1 },
          { id: "seed", kind: "number", min: 0, max: 9999, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["model.deterministic", "hypothesis.transcription", "heuristic.transparent"],
        sourceIds: ["snyder-2024"],
      },
      {
        id: "compare-without-grading",
        protocolId: "measurement-inference.compare-without-grading.v1",
        factorIds: ["offsetMs", "spreadMs", "eventCount", "seed"],
        factors: [
          { id: "offsetMs", kind: "number", min: -150, max: 150, step: 1 },
          { id: "spreadMs", kind: "number", min: 0, max: 100, step: 1 },
          { id: "eventCount", kind: "number", min: 4, max: 64, step: 1 },
          { id: "seed", kind: "number", min: 0, max: 9999, step: 1 },
        ],
        inputModes: ["synthetic"],
        claimIds: ["model.deterministic", "measurement.local", "recommendation.inquiry"],
        sourceIds: ["demos-palmer-2023", "abalde-2024"],
      },
    ],
  },
] as const;

/** Bounds and options are persistence contracts: saved trials outside them are dropped on load. */
function factorContract(factor: FactorDefinition) {
  switch (factor.kind) {
    case "number":
      return { id: factor.id, kind: factor.kind, min: factor.min, max: factor.max, step: factor.step, ...(factor.audioSetting ? { audioSetting: factor.audioSetting } : {}) };
    case "select":
      return { id: factor.id, kind: factor.kind, options: factor.options.map((option) => option.value), ...(factor.audioSetting ? { audioSetting: factor.audioSetting } : {}) };
    case "toggle":
      return { id: factor.id, kind: factor.kind };
  }
}

describe("curriculum compatibility manifest", () => {
  it("preserves every canonical domain and lesson identity in order", () => {
    const currentManifest = curriculumCatalog.map((domain) => ({
      id: domain.id,
      lessons: domain.lessons.map((lesson) => ({
        id: lesson.id,
        protocolId: lesson.protocol.id,
        factorIds: lesson.factors.map((factor) => factor.id),
        factors: lesson.factors.map(factorContract),
        inputModes: lesson.inputModes,
        claimIds: lesson.claimIds,
        sourceIds: lesson.sourceIds,
      })),
    }));

    expect(currentManifest).toEqual(compatibilityManifest);
  });
});
