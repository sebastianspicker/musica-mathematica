import type { EnsembleConfig } from "./ensemble";
import type { EvidenceStatus, LessonStage } from "../learning/lessonAttempt";
import type { ComparisonMode } from "../learning/comparison";

export const defaultConfig: EnsembleConfig = {
  musicianCount: 8,
  tempoBpm: 120,
  tempoSpreadBpm: 7,
  couplingStrength: 1.4,
  latencySeconds: 0.018,
  jitterSeconds: 0,
  topology: "all-to-all",
  repertoireTexture: "pulse",
  clickTrackStrength: 0,
};

export type LessonPreset = {
  id: string;
  title: string;
  purpose: string;
  config: EnsembleConfig;
  prompts: string[];
  learningPath: "synchronise" | "diagnose" | "design";
  evidenceStatus: EvidenceStatus;
  objectives: string[];
  prediction: string;
  observation: string;
  explanation: string;
  companionTask: { solo: string; duo: string };
  comparisonMode: ComparisonMode;
  transfer: string;
  debrief: string;
  misconceptions: string[];
  sources: string[];
  lockedControls: (keyof EnsembleConfig)[];
  recommendedControls: (keyof EnsembleConfig)[];
  scaffold: { initialPrompt: string; fadeAfter: LessonStage };
};

const configControlKeys: readonly (keyof EnsembleConfig)[] = [
  "musicianCount",
  "tempoBpm",
  "tempoSpreadBpm",
  "couplingStrength",
  "latencySeconds",
  "jitterSeconds",
  "topology",
  "repertoireTexture",
  "clickTrackStrength",
];

function lockUnrelatedControls(
  ...recommendedControls: readonly (keyof EnsembleConfig)[]
): (keyof EnsembleConfig)[] {
  const recommended = new Set(recommendedControls);
  return configControlKeys.filter((control) => !recommended.has(control));
}

export const lessonPresets: LessonPreset[] = [
  {
    id: "lock-in",
    title: "1. Hear the Lock-In",
    purpose:
      "Start from loose individual timing, then raise listening strength until a shared pulse emerges.",
    config: {
      ...defaultConfig,
      tempoBpm: 104,
      tempoSpreadBpm: 12,
      couplingStrength: 0.18,
      latencySeconds: 0.012,
      topology: "all-to-all",
      repertoireTexture: "pulse",
      clickTrackStrength: 0,
    },
    prompts: [
      "Press play before touching the equation.",
      "Raise listening strength slowly. Where does the phase circle stop drifting?",
      "Name what changed in musical language before naming it mathematically.",
    ],
    learningPath: "synchronise",
    evidenceStatus: "model-based",
    objectives: ["Relate listening strength to a visible and audible shared pulse."],
    prediction: "Predict whether stronger peer coupling will reduce phase spread.",
    observation: "Compare the loose starting circle with the circle after coupling rises.",
    explanation: "Explain how mutual adjustment changed the two model runs, and why that does not establish a measured rehearsal outcome.",
    companionTask: { solo: "Tap a steady pulse for 20 seconds.", duo: "Notice when two players converge without a click." },
    comparisonMode: "single-control",
    transfer: "Choose one rehearsal cue that supports listening rather than counting harder.",
    debrief: "What evidence distinguished lock-in from merely playing louder?",
    misconceptions: ["Lock-in means every player has identical phase at every instant."],
    sources: [
      "https://doi.org/10.1016/j.tics.2023.05.005",
      "https://doi.org/10.1016/j.neubiorev.2024.105816",
      "SCIENTIFIC_AUDIT.md: model-status limits",
    ],
    lockedControls: lockUnrelatedControls("couplingStrength"),
    recommendedControls: ["couplingStrength"],
    scaffold: { initialPrompt: "Change only listening strength first.", fadeAfter: "compare" },
  },
  {
    id: "latency",
    title: "2. Latency as Material",
    purpose:
      "Show that the same ensemble can lock at a slow tempo and fail at a faster one when delay is fixed.",
    config: {
      ...defaultConfig,
      tempoBpm: 132,
      tempoSpreadBpm: 5,
      couplingStrength: 1.6,
      latencySeconds: 0.075,
      topology: "leader-follower",
      repertoireTexture: "dense-rhythm",
      clickTrackStrength: 0,
    },
    prompts: [
      "Lower the tempo without changing latency.",
      "Ask whether the network failed, or whether the piece exceeded its model delay budget.",
      "Compare the current latency against the idealized phase-budget estimate.",
    ],
    learningPath: "synchronise",
    evidenceStatus: "model-based",
    objectives: ["Explain why a fixed delay occupies more of a faster beat."],
    prediction: "At fixed delay, how will lowering tempo affect the model budget status? State a direction and a reason.",
    observation: "Keep delay fixed while comparing the latency-budget status at two tempi.",
    explanation: "Explain how tempo changed the configured delay's share of the model phase budget, and why that budget is not a network measurement.",
    companionTask: { solo: "Clap a slow and then fast pulse.", duo: "Try one delayed response at both tempi." },
    comparisonMode: "single-control",
    transfer: "Select a slower texture when a delay budget is fragile.",
    debrief: "Which variable changed the ratio: delay, tempo, or both?",
    misconceptions: ["A fixed millisecond delay has the same musical effect at every tempo."],
    sources: [
      "https://doi.org/10.1038/s41598-024-68326-6",
      "https://doi.org/10.3390/fi17080337",
      "SCIENTIFIC_AUDIT.md: latency-budget interpretation",
    ],
    lockedControls: lockUnrelatedControls("tempoBpm"),
    recommendedControls: ["tempoBpm"],
    scaffold: { initialPrompt: "Hold latency constant while changing tempo.", fadeAfter: "compare" },
  },
  {
    id: "click",
    title: "3. Click Track Tradeoff",
    purpose:
      "A click can stabilise modeled timing while shifting coordination away from peer adaptation and toward external forcing.",
    config: {
      ...defaultConfig,
      tempoBpm: 116,
      tempoSpreadBpm: 10,
      couplingStrength: 0.25,
      latencySeconds: 0.045,
      topology: "click-track",
      repertoireTexture: "call-response",
      clickTrackStrength: 2.1,
    },
    prompts: [
      "Watch timing precision improve.",
      "Then watch peer-coupling share drop.",
      "Discuss whether that is a technical win or a musical change.",
    ],
    learningPath: "synchronise",
    evidenceStatus: "model-based",
    objectives: ["Distinguish external timing force from peer adaptation."],
    prediction: "How will increasing click strength affect phase spread and peer-coupling share? State both expected directions.",
    observation: "Compare phase-spread equivalent and peer-coupling share as the click dominates.",
    explanation: "Explain how external forcing changed phase spread and peer-coupling share, including what this teaching model leaves out.",
    companionTask: { solo: "Play a phrase with and without a metronome.", duo: "Decide when to follow the click and when to follow each other." },
    comparisonMode: "single-control",
    transfer: "Set a click policy for a passage that needs both precision and response.",
    debrief: "What musical information becomes less important when the click dominates?",
    misconceptions: ["Lower phase spread automatically means better ensemble listening."],
    sources: [
      "https://doi.org/10.1525/mp.2024.42.1.48",
      "https://doi.org/10.3389/fpsyg.2022.891025",
      "SCIENTIFIC_AUDIT.md: click-track tradeoff",
    ],
    lockedControls: lockUnrelatedControls("clickTrackStrength"),
    recommendedControls: ["clickTrackStrength"],
    scaffold: { initialPrompt: "Observe both displayed metrics before judging the result.", fadeAfter: "explain" },
  },
  {
    id: "low-latency-route",
    title: "4. Low-Latency Route Check",
    purpose:
      "Test whether an illustrative low-latency route is plausible for the selected musical material.",
    config: {
      ...defaultConfig,
      tempoBpm: 128,
      tempoSpreadBpm: 6,
      couplingStrength: 1.25,
      latencySeconds: 0.0075,
      jitterSeconds: 0.002,
      topology: "all-to-all",
      repertoireTexture: "dense-rhythm",
      clickTrackStrength: 0,
    },
    prompts: [
      "Start with an illustrative one-way latency near 7.5 ms.",
      "Raise tempo and texture density until the model delay budget becomes fragile.",
      "State what the model predicts, then name the measurements needed for a real rehearsal decision.",
    ],
    learningPath: "diagnose",
    evidenceStatus: "model-based",
    objectives: ["Use a model latency budget to reason about a route scenario."],
    prediction: "At the same route delay, which texture do you expect to become fragile first, and why?",
    observation: "Compare the model status after changing tempo or texture one at a time.",
    explanation: "Explain what the model comparison suggests about the selected material and which route measurements are still missing.",
    companionTask: { solo: "Mark the shortest attack-to-attack interval in a part.", duo: "Identify one passage that tolerates delayed response." },
    comparisonMode: "single-control",
    transfer: "Draft a rehearsal plan that substitutes slower material when the route is fragile.",
    debrief: "What would need measuring before claiming a real route is viable?",
    misconceptions: ["A displayed millisecond value proves end-to-end system latency."],
    sources: [
      "https://doi.org/10.3390/fi17080337",
      "SCIENTIFIC_AUDIT.md: illustrative low-latency scenarios",
    ],
    lockedControls: lockUnrelatedControls("tempoBpm", "repertoireTexture"),
    recommendedControls: ["tempoBpm", "repertoireTexture"],
    scaffold: { initialPrompt: "Keep the route delay fixed; test the musical demand.", fadeAfter: "compare" },
  },
  {
    id: "diagnose-instability",
    title: "5. Diagnose Instability",
    purpose:
      "Separate weak listening, wide natural tempo spread, latency, and jitter as different causes of collapse.",
    config: {
      ...defaultConfig,
      tempoBpm: 122,
      tempoSpreadBpm: 15,
      couplingStrength: 0.55,
      latencySeconds: 0.055,
      jitterSeconds: 0.026,
      topology: "leader-follower",
      repertoireTexture: "pulse",
      clickTrackStrength: 0,
    },
    prompts: [
      "Change only one parameter at a time.",
      "First raise listening strength, then reduce tempo spread, then reduce jitter.",
      "Name which intervention actually restores coherence.",
    ],
    learningPath: "diagnose",
    evidenceStatus: "model-based",
    objectives: ["Separate modeled causes of unstable coordination."],
    prediction: "Predict which single intervention most improves coherence in this starting state.",
    observation: "Record two one-variable runs before comparing effects.",
    explanation: "Explain which modeled stressor changed the outcome, and why that result does not diagnose a real ensemble automatically.",
    companionTask: { solo: "List one timing symptom and one possible cause.", duo: "Agree on the first reversible rehearsal intervention." },
    comparisonMode: "single-control",
    transfer: "Use a one-change-at-a-time troubleshooting order for a new passage.",
    debrief: "Why was changing several controls at once weak evidence?",
    misconceptions: ["Any loss of coherence is caused by latency alone."],
    sources: [
      "https://doi.org/10.1525/mp.2024.42.1.48",
      "https://doi.org/10.1016/j.tics.2023.05.005",
      "SCIENTIFIC_AUDIT.md: causal interpretation limits",
    ],
    lockedControls: lockUnrelatedControls("couplingStrength", "tempoSpreadBpm", "jitterSeconds"),
    recommendedControls: ["couplingStrength", "tempoSpreadBpm", "jitterSeconds"],
    scaffold: { initialPrompt: "Make one change, record it, then make the next.", fadeAfter: "explain" },
  },
  {
    id: "click-or-peer-coupling",
    title: "6. Click or Peer Coupling",
    purpose:
      "Compare timing precision under a click against reduced peer-driven adaptation.",
    config: {
      ...defaultConfig,
      tempoBpm: 118,
      tempoSpreadBpm: 12,
      couplingStrength: 0.3,
      latencySeconds: 0.035,
      jitterSeconds: 0.006,
      topology: "click-track",
      repertoireTexture: "pulse",
      clickTrackStrength: 2.4,
    },
    prompts: [
      "Watch the phase-spread equivalent drop when the click dominates.",
      "Then lower click strength and raise peer coupling.",
      "Decide whether the piece needs precision, peer adaptation, or a compromise.",
    ],
    learningPath: "diagnose",
    evidenceStatus: "model-based",
    objectives: ["Compare two coordination strategies against a musical criterion."],
    prediction: "Predict which strategy lowers phase spread and which preserves peer share.",
    observation: "Record a click-led run and a peer-led run before interpreting the tradeoff.",
    explanation: "Explain the modeled trade-off between precision and peer adaptation, then state why the metrics do not score musical quality.",
    companionTask: { solo: "Name one passage that needs exact attacks.", duo: "Choose a cueing strategy for a responsive phrase." },
    comparisonMode: "all-recommended-controls",
    transfer: "Justify a click setting using both precision and adaptation evidence.",
    debrief: "Which criterion mattered most for this imagined passage?",
    misconceptions: ["There is one universally optimal click strength."],
    sources: [
      "https://doi.org/10.1016/j.neubiorev.2024.105816",
      "https://doi.org/10.1525/mp.2024.42.1.48",
      "SCIENTIFIC_AUDIT.md: peer-coupling interpretation",
    ],
    lockedControls: lockUnrelatedControls("clickTrackStrength", "couplingStrength"),
    recommendedControls: ["clickTrackStrength", "couplingStrength"],
    scaffold: { initialPrompt: "Make each run represent a different coordination strategy.", fadeAfter: "compare" },
  },
  {
    id: "compose-with-latency",
    title: "7. Compose With Latency",
    purpose:
      "Treat delay as a compositional constraint by switching to slower call-response or rubato material.",
    config: {
      ...defaultConfig,
      tempoBpm: 72,
      tempoSpreadBpm: 5,
      couplingStrength: 0.9,
      latencySeconds: 0.12,
      jitterSeconds: 0.012,
      topology: "sections",
      repertoireTexture: "call-response",
      clickTrackStrength: 0,
    },
    prompts: [
      "Keep latency high and avoid trying to remove it.",
      "Switch between dense rhythm, rubato, and call-response textures.",
      "Describe how the compositional problem changes when delay becomes material.",
    ],
    learningPath: "design",
    evidenceStatus: "classroom-observation",
    objectives: ["Design a response pattern that accommodates a delayed relationship."],
    prediction: "Predict which texture remains workable when the modeled delay stays high.",
    observation: "Compare at least two textures without changing the configured delay.",
    explanation: "Explain why the texture change altered the model result, and why workability remains a design judgment to test with players.",
    companionTask: { solo: "Sketch a call-and-response gesture with space for reply.", duo: "Perform the gesture while deliberately waiting for each response." },
    comparisonMode: "single-control",
    transfer: "Adapt a dense passage into a delayed-response version for a chosen ensemble.",
    debrief: "What did the delay invite you to compose rather than eliminate?",
    misconceptions: ["Delay only represents technical failure and cannot shape musical form."],
    sources: [
      "https://doi.org/10.1016/j.neubiorev.2024.105816",
      "https://doi.org/10.1109/ACCESS.2016.2628440",
      "SCIENTIFIC_AUDIT.md: classroom-use limits",
    ],
    lockedControls: lockUnrelatedControls("repertoireTexture", "tempoBpm"),
    recommendedControls: ["repertoireTexture", "tempoBpm"],
    scaffold: { initialPrompt: "Keep delay constant and redesign the material around it.", fadeAfter: "perform" },
  },
];

export function lessonById(id: string): LessonPreset | undefined {
  return lessonPresets.find((lesson) => lesson.id === id);
}
