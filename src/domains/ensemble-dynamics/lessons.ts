import type { DomainDefinition, ThreeLessons } from "../../curriculum/contracts";
import { lesson, numberFactor, selectFactor } from "../support/construction";
import { ensembleConfigBounds } from "./ensembleConfig";

const milliseconds = (seconds: number): number => seconds * 1000;

const lessons = [
      lesson("ensemble-dynamics", 1, {
        id: "lock-in-and-order",
        level: "foundation",
        title: "Lock-In and Order",
        shortTitle: "Lock-in & order",
        question: "When does mutual adjustment produce a coherent phase pattern in this model?",
        objective: "Relate coupling strength to the Kuramoto order parameter without grading musicianship.",
        equation: "r = |N^-1 sum exp(i theta_j)|",
        equationCaption: "The order parameter r is 0–1 phase concentration, not musical quality.",
        predictionPrompt: "Predict how stronger peer coupling changes terminal coherence.",
        experimentPrompt: "Change coupling only and compare deterministic eight-second trials.",
        interpretationPrompt: "Explain model lock-in and name at least one missing human coordination cue.",
        transferPrompt: "Design a listening cue that could be tested separately with players.",
        factors: [
          numberFactor("musicianCount", "Musicians", 8, ensembleConfigBounds.musicianCount.min, ensembleConfigBounds.musicianCount.max, ensembleConfigBounds.musicianCount.step, "", "Number of model oscillators."),
          numberFactor("tempoBpm", "Tempo", 104, ensembleConfigBounds.tempoBpm.min, ensembleConfigBounds.tempoBpm.max, ensembleConfigBounds.tempoBpm.step, "BPM", "Mean natural tempo."),
          numberFactor("tempoSpreadBpm", "Tempo spread", 12, ensembleConfigBounds.tempoSpreadBpm.min, ensembleConfigBounds.tempoSpreadBpm.max, ensembleConfigBounds.tempoSpreadBpm.step, "BPM", "Deterministic spread of natural tempi."),
          numberFactor("couplingStrength", "Peer coupling", 0.25, ensembleConfigBounds.couplingStrength.min, ensembleConfigBounds.couplingStrength.max, ensembleConfigBounds.couplingStrength.step, "", "Mutual phase-adjustment strength."),
        ],
        claimIds: ["model.ensemble", "heuristic.transparent", "literature.context", "recommendation.inquiry"],
        sourceIds: ["demos-palmer-2023", "abalde-2024"],
      }),
      lesson("ensemble-dynamics", 2, {
        id: "delay-jitter-topology",
        level: "model",
        title: "Delay, Jitter, and Topology",
        shortTitle: "Delay & topology",
        question: "How do fixed delay, varying delay, and who listens to whom alter the model?",
        objective: "Compare delayed network configurations using one controlled factor change.",
        equation: "dtheta_i/dt = omega_i + K d_i^-1/2 sum A_ij sin(theta_j(t-tau)-theta_i)",
        equationCaption: "The implemented peer term includes square-root degree normalization; jitter and texture remain transparent heuristics.",
        predictionPrompt: "Predict which selected factor most changes coherence and phase spread.",
        experimentPrompt: "Change delay, jitter, or topology one at a time; keep the remaining factors fixed.",
        interpretationPrompt: "Distinguish a model stressor from a diagnosis of a real route or rehearsal.",
        transferPrompt: "List the route measurements needed before making a deployment claim.",
        factors: [
          numberFactor("latencyMs", "One-way delay", 55, milliseconds(ensembleConfigBounds.latencySeconds.min), milliseconds(ensembleConfigBounds.latencySeconds.max), milliseconds(ensembleConfigBounds.latencySeconds.step), "ms", "Configured model delay, not measured latency."),
          numberFactor("jitterMs", "Delay variation", 18, milliseconds(ensembleConfigBounds.jitterSeconds.min), milliseconds(ensembleConfigBounds.jitterSeconds.max), milliseconds(ensembleConfigBounds.jitterSeconds.step), "ms", "Qualitative jitter control."),
          numberFactor("couplingStrength", "Peer coupling", 1.1, ensembleConfigBounds.couplingStrength.min, ensembleConfigBounds.couplingStrength.max, ensembleConfigBounds.couplingStrength.step, "", "Peer phase-adjustment strength."),
          selectFactor("topology", "Listening topology", "leader-follower", [
            { value: "all-to-all", label: "All-to-all" },
            { value: "leader-follower", label: "Leader–follower" },
            { value: "sections", label: "Sections" },
          ], "Who receives modeled phase information from whom."),
        ],
        claimIds: ["model.ensemble", "heuristic.transparent", "literature.context", "recommendation.inquiry"],
        sourceIds: ["demos-palmer-2023", "abalde-2024"],
      }),
      lesson("ensemble-dynamics", 3, {
        id: "external-pulse-or-peer-adaptation",
        level: "critique",
        title: "External Pulse or Peer Adaptation",
        shortTitle: "Pulse or peers",
        question: "What changes when the model follows an external pulse instead of one another?",
        objective: "Compare timing concentration and peer-coupling share without declaring one strategy better.",
        equation: "dtheta_i/dt = peer_i + C sin(Omega t - theta_i)",
        equationCaption: "External forcing C is modeled separately from peer coupling K.",
        predictionPrompt: "Predict how stronger click forcing changes phase spread and peer share.",
        experimentPrompt: "Record one peer-led and one externally forced strategy.",
        interpretationPrompt: "Choose a musical criterion before interpreting the trade-off.",
        transferPrompt: "Draft a reversible click policy for one passage.",
        factors: [
          numberFactor("clickTrackStrength", "External pulse", 2.2, ensembleConfigBounds.clickTrackStrength.min, ensembleConfigBounds.clickTrackStrength.max, ensembleConfigBounds.clickTrackStrength.step, "", "Strength of the common external phase force."),
          numberFactor("couplingStrength", "Peer coupling", 0.35, ensembleConfigBounds.couplingStrength.min, ensembleConfigBounds.couplingStrength.max, ensembleConfigBounds.couplingStrength.step, "", "Strength of mutual adjustment."),
          numberFactor("tempoSpreadBpm", "Tempo spread", 10, ensembleConfigBounds.tempoSpreadBpm.min, ensembleConfigBounds.tempoSpreadBpm.max, ensembleConfigBounds.tempoSpreadBpm.step, "BPM", "Deterministic natural-tempo variation."),
          numberFactor("tempoBpm", "Tempo", 116, ensembleConfigBounds.tempoBpm.min, ensembleConfigBounds.tempoBpm.max, ensembleConfigBounds.tempoBpm.step, "BPM", "Mean natural tempo and external pulse rate."),
        ],
        claimIds: ["model.ensemble", "heuristic.transparent", "literature.context", "recommendation.inquiry"],
        sourceIds: ["demos-palmer-2023", "abalde-2024"],
      }),
] as const satisfies ThreeLessons;

export const ensembleDynamicsDefinition: DomainDefinition<typeof lessons> = {
  id: "ensemble-dynamics",
  number: 2,
  title: "Ensemble Dynamics",
  shortTitle: "Ensemble",
  mark: "⌁",
  description: "Explore phase lock-in, delay, network topology, and external forcing.",
  lessons,
};
