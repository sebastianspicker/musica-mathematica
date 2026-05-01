import type { EnsembleConfig } from "./ensemble";

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
};

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
  },
  {
    id: "click",
    title: "3. Click Track Tradeoff",
    purpose:
      "A click stabilises timing, but it replaces peer-to-peer adaptation with external forcing.",
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
      "Decide whether the rehearsal is physically plausible or needs slower material.",
    ],
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
      "Watch the timing error drop when the click dominates.",
      "Then lower click strength and raise peer coupling.",
      "Decide whether the piece needs precision, peer adaptation, or a compromise.",
    ],
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
  },
];

export function lessonById(id: string): LessonPreset {
  return lessonPresets.find((lesson) => lesson.id === id) ?? lessonPresets[0];
}
