import type { ClaimKind, ClaimRecord } from "../labs/types";

export const evidenceLabels: Readonly<Record<ClaimKind, string>> = {
  "definition-or-theorem": "Definition / theorem",
  "computed-model-result": "Computed result",
  "measured-observation": "Measured observation",
  "transcription-hypothesis": "Transcription hypothesis",
  "empirical-literature": "Empirical context",
  heuristic: "Heuristic",
  recommendation: "Recommendation",
};

export const claims: readonly ClaimRecord[] = [
  {
    id: "math.identity",
    kind: "definition-or-theorem",
    statement: "The displayed identity follows from the stated mathematical definitions.",
    scope: "Exact arithmetic and discrete mathematical representations in this lab.",
    assumptions: ["Inputs satisfy the displayed domain restrictions."],
    sourceIds: [],
    allowedInference: "The identity is valid for the displayed inputs and definitions.",
    forbiddenInference: "The identity alone predicts perception, preference, or performance quality.",
  },
  {
    id: "model.deterministic",
    kind: "computed-model-result",
    statement: "The result is computed by the published deterministic model and protocol.",
    scope: "This browser run with its recorded factors, seed, duration, and method.",
    assumptions: ["The implementation matches the documented model.", "Floating-point precision is adequate for the teaching task."],
    sourceIds: [],
    allowedInference: "The same inputs and version reproduce the same model result.",
    forbiddenInference: "The result is a measurement of musicians, a room, or a network.",
  },
  {
    id: "model.ensemble",
    kind: "computed-model-result",
    statement: "Ensemble observables are outputs of the delayed phase-oscillator teaching model.",
    scope: "The configured phase-only ensemble simulation.",
    assumptions: ["Musicians are represented as phase oscillators.", "Qualitative texture and jitter mappings are accepted as model terms."],
    sourceIds: ["demos-palmer-2023", "abalde-2024"],
    allowedInference: "A controlled parameter change altered the model trajectory or terminal metrics.",
    forbiddenInference: "The displayed state diagnoses or grades a real ensemble.",
  },
  {
    id: "measurement.local",
    kind: "measured-observation",
    statement: "A value was derived locally from the selected browser audio segment.",
    scope: "The bounded segment and published analysis settings shown with the result.",
    assumptions: ["Browser decoding and capture completed without undisclosed gaps.", "Input remains uncalibrated."],
    sourceIds: ["w3c-webaudio", "w3c-mediacapture"],
    allowedInference: "The algorithm returned this descriptive feature for this segment.",
    forbiddenInference: "The value is calibrated SPL, diagnostic evidence, or a stable property of the performer.",
  },
  {
    id: "hypothesis.transcription",
    kind: "transcription-hypothesis",
    statement: "Tempo, meter, pitch, and chord labels are ranked algorithmic hypotheses.",
    scope: "The analyzed segment and the alternatives displayed alongside confidence or score.",
    assumptions: ["The signal contains features represented by the lightweight estimator."],
    sourceIds: [],
    allowedInference: "The label is one candidate to check by ear and against the score or context.",
    forbiddenInference: "The top-ranked label is a definitive transcription or complete polyphonic score.",
  },
  {
    id: "literature.context",
    kind: "empirical-literature",
    statement: "Published research provides context for the question, not automatic calibration of this app.",
    scope: "The populations, tasks, methods, and conditions reported by the cited work.",
    assumptions: ["Transfer beyond the study context requires justification."],
    sourceIds: [],
    allowedInference: "The lesson question connects to an active empirical research area.",
    forbiddenInference: "The literature validates this implementation or makes its output universal.",
  },
  {
    id: "heuristic.transparent",
    kind: "heuristic",
    statement: "The displayed mapping is a transparent teaching heuristic.",
    scope: "Qualitative controls, proxies, ranking scores, and interpretation bands identified in the interface.",
    assumptions: ["The mapping is used for comparison rather than calibration."],
    sourceIds: [],
    allowedInference: "The proxy supports a structured comparison inside this lesson.",
    forbiddenInference: "The proxy is a validated perceptual or musical-quality scale.",
  },
  {
    id: "recommendation.inquiry",
    kind: "recommendation",
    statement: "The interface recommends an inquiry or rehearsal action to test in context.",
    scope: "Teaching and reflective practice, not prescription.",
    assumptions: ["Learners and instructors retain musical judgment."],
    sourceIds: ["wang-2025"],
    allowedInference: "The action can generate another observation or comparison.",
    forbiddenInference: "The recommendation is proven optimal or improves learning by itself.",
  },
];

const claimIndex = new Map(claims.map((claim) => [claim.id, claim]));

export function claimById(id: string): ClaimRecord | undefined {
  return claimIndex.get(id);
}

export function claimsByIds(ids: readonly string[]): ClaimRecord[] {
  return ids.flatMap((id) => {
    const claim = claimById(id);
    return claim ? [claim] : [];
  });
}
