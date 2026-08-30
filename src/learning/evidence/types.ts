export const claimKinds = ["definition-or-theorem", "computed-model-result", "measured-observation", "transcription-hypothesis", "empirical-literature", "heuristic", "recommendation"] as const;
export type ClaimKind = (typeof claimKinds)[number];
export type ClaimRecord = Readonly<{ id: string; kind: ClaimKind; statement: string; scope: string; assumptions: readonly string[]; sourceIds: readonly string[]; allowedInference: string; forbiddenInference: string }>;
