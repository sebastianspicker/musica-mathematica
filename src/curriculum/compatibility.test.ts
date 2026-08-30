import { describe, expect, it } from "vitest";
import { curriculumCatalog } from "./catalog";

const compatibilityManifest = [
  {
    id: "phase-proportion",
    lessons: [
      {
        id: "from-bpm-to-period",
        protocolId: "phase-proportion.from-bpm-to-period.v1",
        factorIds: ["bpm", "beatsPerBar"],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["snyder-2024"],
      },
      {
        id: "polyrhythm-return-times",
        protocolId: "phase-proportion.polyrhythm-return-times.v1",
        factorIds: ["pulseA", "pulseB", "bpm"],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["jacoby-2024", "snyder-2024"],
      },
      {
        id: "phase-on-the-circle",
        protocolId: "phase-proportion.phase-on-the-circle.v1",
        factorIds: ["periodA", "periodB", "elapsed", "offset"],
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
        inputModes: ["synthetic"],
        claimIds: ["model.ensemble", "heuristic.transparent", "literature.context", "recommendation.inquiry"],
        sourceIds: ["demos-palmer-2023", "abalde-2024"],
      },
      {
        id: "delay-jitter-topology",
        protocolId: "ensemble-dynamics.delay-jitter-topology.v1",
        factorIds: ["latencyMs", "jitterMs", "couplingStrength", "topology"],
        inputModes: ["synthetic"],
        claimIds: ["model.ensemble", "heuristic.transparent", "literature.context", "recommendation.inquiry"],
        sourceIds: ["demos-palmer-2023", "abalde-2024"],
      },
      {
        id: "external-pulse-or-peer-adaptation",
        protocolId: "ensemble-dynamics.external-pulse-or-peer-adaptation.v1",
        factorIds: ["clickTrackStrength", "couplingStrength", "tempoSpreadBpm", "tempoBpm"],
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
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["jacoby-2024", "snyder-2024"],
      },
      {
        id: "autocorrelation-spectrum-meter",
        protocolId: "rhythm-meter.autocorrelation-spectrum-meter.v1",
        factorIds: ["steps", "pulses", "rotation"],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry", "heuristic.transparent"],
        sourceIds: ["jacoby-2024", "snyder-2024"],
      },
      {
        id: "recorded-onset-hypotheses",
        protocolId: "rhythm-meter.recorded-onset-hypotheses.v1",
        factorIds: ["tempoBpm", "threshold", "meterBias"],
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
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["marjieh-2024"],
      },
      {
        id: "temperaments-and-commas",
        protocolId: "pitch-tuning.temperaments-and-commas.v1",
        factorIds: ["divisions", "numerator", "denominator", "referenceHz"],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry", "heuristic.transparent"],
        sourceIds: ["marjieh-2024"],
      },
      {
        id: "timbre-changes-consonance",
        protocolId: "pitch-tuning.timbre-changes-consonance.v1",
        factorIds: ["intervalCents", "partialCount", "rolloff"],
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
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["frederick-2023"],
      },
      {
        id: "tonnetz-and-voice-leading",
        protocolId: "harmony-geometry.tonnetz-and-voice-leading.v1",
        factorIds: ["chordA", "chordB", "metric"],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry", "heuristic.transparent"],
        sourceIds: ["frederick-2023"],
      },
      {
        id: "chord-hypotheses",
        protocolId: "harmony-geometry.chord-hypotheses.v1",
        factorIds: ["root", "quality", "ambiguity"],
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
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["marjieh-2024"],
      },
      {
        id: "fourier-windows-aliasing",
        protocolId: "timbre-acoustics.fourier-windows-aliasing.v1",
        factorIds: ["frequencyHz", "sampleRateHz", "frameSize"],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: ["w3c-webaudio"],
      },
      {
        id: "time-varying-timbre",
        protocolId: "timbre-acoustics.time-varying-timbre.v1",
        factorIds: ["attackMs", "decayMs", "modulationHz", "modulationDepth"],
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
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: [],
      },
      {
        id: "markov-memory",
        protocolId: "probability-form.markov-memory.v1",
        factorIds: ["stayProbability", "length", "seed"],
        inputModes: ["synthetic"],
        claimIds: ["math.identity", "model.deterministic", "literature.context", "recommendation.inquiry"],
        sourceIds: [],
      },
      {
        id: "entropy-surprisal-form",
        protocolId: "probability-form.entropy-surprisal-form.v1",
        factorIds: ["probability", "length", "seed"],
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
        inputModes: ["synthetic"],
        claimIds: ["model.deterministic", "measurement.local", "heuristic.transparent", "recommendation.inquiry"],
        sourceIds: ["w3c-webaudio", "w3c-mediacapture"],
      },
      {
        id: "recovering-parameters",
        protocolId: "measurement-inference.recovering-parameters.v1",
        factorIds: ["tempoBpm", "jitterMs", "sampleCount", "seed"],
        inputModes: ["synthetic"],
        claimIds: ["model.deterministic", "hypothesis.transcription", "heuristic.transparent"],
        sourceIds: ["snyder-2024"],
      },
      {
        id: "compare-without-grading",
        protocolId: "measurement-inference.compare-without-grading.v1",
        factorIds: ["offsetMs", "spreadMs", "eventCount", "seed"],
        inputModes: ["synthetic"],
        claimIds: ["model.deterministic", "measurement.local", "recommendation.inquiry"],
        sourceIds: ["demos-palmer-2023", "abalde-2024"],
      },
    ],
  },
] as const;

describe("curriculum compatibility manifest", () => {
  it("preserves every canonical domain and lesson identity in order", () => {
    const currentManifest = curriculumCatalog.map((domain) => ({
      id: domain.id,
      lessons: domain.lessons.map((lesson) => ({
        id: lesson.id,
        protocolId: lesson.protocol.id,
        factorIds: lesson.factors.map((factor) => factor.id),
        inputModes: lesson.inputModes,
        claimIds: lesson.claimIds,
        sourceIds: lesson.sourceIds,
      })),
    }));

    expect(currentManifest).toEqual(compatibilityManifest);
  });
});
