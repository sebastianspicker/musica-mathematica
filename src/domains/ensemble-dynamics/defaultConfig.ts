import type { EnsembleConfig } from "./ensemble";

/** The live default configuration used by the ensemble-dynamics evaluators. */
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
