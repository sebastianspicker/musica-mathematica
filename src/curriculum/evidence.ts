export const claimKinds = ["definition-or-theorem", "computed-model-result", "measured-observation", "transcription-hypothesis", "empirical-literature", "heuristic", "recommendation"] as const;
export type ClaimKind = (typeof claimKinds)[number];
export type ClaimRecord = Readonly<{ id: string; kind: ClaimKind; statement: string; scope: string; assumptions: readonly string[]; sourceIds: readonly string[]; allowedInference: string; forbiddenInference: string }>;

export type ResearchSource = Readonly<{ id: string; title: string; authors: string; year: number; url: string; role: string }>;
export const researchSources: readonly ResearchSource[] = [
  { id: "zhu-2025", title: "Development of flipped classroom module FCM for music theory instruction", authors: "Zhu and colleagues", year: 2025, url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12637912/", role: "Recent music-theory teaching design context; it does not validate this lab." },
  { id: "wang-2025", title: "From Practice to Reflection: A Systematic Review of Mechanisms Driving Metacognition and SRL in Music", authors: "Wang and colleagues", year: 2025, url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12734040/", role: "Supports structured plan-practice-reflection and explicit feedback loops, with study-level limits." },
  { id: "jacoby-2024", title: "Commonality and variation in mental representations of music revealed by a cross-cultural comparison of rhythm priors in 15 countries", authors: "Jacoby and colleagues", year: 2024, url: "https://www.nature.com/articles/s41562-023-01800-9", role: "Guards against treating one metric or representation of rhythm as culturally universal." },
  { id: "marjieh-2024", title: "Timbral effects on consonance disentangle psychoacoustic mechanisms and suggest perceptual origins for musical scales", authors: "Marjieh and colleagues", year: 2024, url: "https://www.nature.com/articles/s41467-024-45812-z", role: "Empirical context for timbre-dependent consonance; app proxies are not calibrated replicas." },
  { id: "snyder-2024", title: "Theoretical and empirical advances in understanding musical rhythm, beat and metre", authors: "Snyder and colleagues", year: 2024, url: "https://www.nature.com/articles/s44159-024-00315-y", role: "Current review context for rhythm, beat, and metre beyond onset-vector computations." },
  { id: "frederick-2023", title: "Diatonic Voice-Leading Transformations", authors: "Leah Frederick", year: 2023, url: "https://doi.org/10.1093/mts/mtad017", role: "Music-theory context for transformational and voice-leading spaces." },
  { id: "demos-palmer-2023", title: "Social and nonlinear dynamics unite: Musical group synchrony", authors: "Demos and Palmer", year: 2023, url: "https://doi.org/10.1016/j.tics.2023.05.005", role: "Empirical and theoretical context for emergent group synchrony beyond pairwise phase models." },
  { id: "abalde-2024", title: "A framework for joint music making", authors: "Abalde and colleagues", year: 2024, url: "https://doi.org/10.1016/j.neubiorev.2024.105816", role: "Frames coordination alongside knowledge, goals, strategies, and social factors." },
  { id: "w3c-webaudio", title: "Web Audio API", authors: "W3C Web Audio Working Group", year: 2024, url: "https://www.w3.org/TR/webaudio/", role: "Normative browser audio-processing interface used by the local pipeline." },
  { id: "w3c-mediacapture", title: "Media Capture and Streams", authors: "W3C WebRTC Working Group", year: 2025, url: "https://www.w3.org/TR/mediacapture-streams/", role: "Normative media-capture interface and constraint behavior." },
];
const sourceIndex = new Map(researchSources.map((source) => [source.id, source]));
export const sourceById = (id: string): ResearchSource | undefined => sourceIndex.get(id);

export const evidenceLabels: Readonly<Record<ClaimKind, string>> = { "definition-or-theorem": "Definition / theorem", "computed-model-result": "Computed result", "measured-observation": "Measured observation", "transcription-hypothesis": "Transcription hypothesis", "empirical-literature": "Empirical context", heuristic: "Heuristic", recommendation: "Recommendation" };
export const claims: readonly ClaimRecord[] = [
  { id: "math.identity", kind: "definition-or-theorem", statement: "The displayed identity follows from the stated mathematical definitions.", scope: "Exact arithmetic and discrete mathematical representations in this lab.", assumptions: ["Inputs satisfy the displayed domain restrictions."], sourceIds: [], allowedInference: "The identity is valid for the displayed inputs and definitions.", forbiddenInference: "The identity alone predicts perception, preference, or performance quality." },
  { id: "model.deterministic", kind: "computed-model-result", statement: "The result is computed by the published deterministic model and protocol.", scope: "This browser run with its recorded factors, seed, duration, and method.", assumptions: ["The implementation matches the documented model.", "Floating-point precision is adequate for the teaching task."], sourceIds: [], allowedInference: "The same inputs and version reproduce the same model result.", forbiddenInference: "The result is a measurement of musicians, a room, or a network." },
  { id: "model.ensemble", kind: "computed-model-result", statement: "Ensemble observables are outputs of the delayed phase-oscillator teaching model.", scope: "The configured phase-only ensemble simulation.", assumptions: ["Musicians are represented as phase oscillators.", "Qualitative texture and jitter mappings are accepted as model terms."], sourceIds: ["demos-palmer-2023", "abalde-2024"], allowedInference: "A controlled parameter change altered the model trajectory or terminal metrics.", forbiddenInference: "The displayed state diagnoses or grades a real ensemble." },
  { id: "measurement.local", kind: "measured-observation", statement: "A value was derived locally from the selected browser audio segment.", scope: "The bounded segment and published analysis settings shown with the result.", assumptions: ["Browser decoding and capture completed without undisclosed gaps.", "Input remains uncalibrated."], sourceIds: ["w3c-webaudio", "w3c-mediacapture"], allowedInference: "The algorithm returned this descriptive feature for this segment.", forbiddenInference: "The value is calibrated SPL, diagnostic evidence, or a stable property of the performer." },
  { id: "hypothesis.transcription", kind: "transcription-hypothesis", statement: "Tempo, meter, pitch, and chord labels are ranked algorithmic hypotheses.", scope: "The analyzed segment and the alternatives displayed alongside confidence or score.", assumptions: ["The signal contains features represented by the lightweight estimator."], sourceIds: [], allowedInference: "The label is one candidate to check by ear and against the score or context.", forbiddenInference: "The top-ranked label is a definitive transcription or complete polyphonic score." },
  { id: "literature.context", kind: "empirical-literature", statement: "Published research provides context for the question, not automatic calibration of this app.", scope: "The populations, tasks, methods, and conditions reported by the cited work.", assumptions: ["Transfer beyond the study context requires justification."], sourceIds: [], allowedInference: "The lesson question connects to an active empirical research area.", forbiddenInference: "The literature validates this implementation or makes its output universal." },
  { id: "heuristic.transparent", kind: "heuristic", statement: "The displayed mapping is a transparent teaching heuristic.", scope: "Qualitative controls, proxies, ranking scores, and interpretation bands identified in the interface.", assumptions: ["The mapping is used for comparison rather than calibration."], sourceIds: [], allowedInference: "The proxy supports a structured comparison inside this lesson.", forbiddenInference: "The proxy is a validated perceptual or musical-quality scale." },
  { id: "recommendation.inquiry", kind: "recommendation", statement: "The interface recommends an inquiry or rehearsal action to test in context.", scope: "Teaching and reflective practice, not prescription.", assumptions: ["Learners and instructors retain musical judgment."], sourceIds: ["wang-2025"], allowedInference: "The action can generate another observation or comparison.", forbiddenInference: "The recommendation is proven optimal or improves learning by itself." },
];
const claimIndex = new Map(claims.map((claim) => [claim.id, claim]));
export const claimById = (id: string): ClaimRecord | undefined => claimIndex.get(id);
export const claimsByIds = (ids: readonly string[]): ClaimRecord[] => ids.flatMap((id) => { const claim = claimById(id); return claim ? [claim] : []; });

/** Claims of these kinds describe a specific result and appear only when an evaluation produced them. */
const resultDependentKinds: ReadonlySet<ClaimKind> = new Set<ClaimKind>(["measured-observation", "transcription-hypothesis"]);

/** Lesson claims to show for an evaluation: result-dependent kinds only when the result cites them, plus every cited claim. */
export function evidenceClaimIdsFor(
  lessonClaimIds: readonly string[],
  resultClaimIds: readonly string[],
): readonly string[] {
  const resultClaims = new Set(resultClaimIds);
  const contextual = lessonClaimIds.filter((claimId) => {
    const kind = claimById(claimId)?.kind;
    return kind === undefined || !resultDependentKinds.has(kind) || resultClaims.has(claimId);
  });
  return [...new Set([...contextual, ...resultClaims])];
}
