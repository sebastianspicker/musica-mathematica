export type Topology = "all-to-all" | "leader-follower" | "sections" | "click-track";

export type RepertoireTexture =
  | "pulse"
  | "drone"
  | "call-response"
  | "rubato"
  | "dense-rhythm";

export type EnsembleConfig = {
  musicianCount: number;
  tempoBpm: number;
  tempoSpreadBpm: number;
  couplingStrength: number;
  latencySeconds: number;
  jitterSeconds: number;
  topology: Topology;
  repertoireTexture: RepertoireTexture;
  clickTrackStrength: number;
};

export const ensembleConfigBounds = {
  musicianCount: { min: 2, max: 16, step: 1 },
  tempoBpm: { min: 50, max: 180, step: 1 },
  tempoSpreadBpm: { min: 0, max: 24, step: 0.5 },
  couplingStrength: { min: 0, max: 3, step: 0.05 },
  latencySeconds: { min: 0, max: 0.18, step: 0.001 },
  jitterSeconds: { min: 0, max: 0.06, step: 0.001 },
  clickTrackStrength: { min: 0, max: 3, step: 0.05 },
} as const;

export type TextureProfile = {
  tempoSpreadMultiplier: number;
  peerCouplingMultiplier: number;
  clickTrackMultiplier: number;
  latencyBudgetMultiplier: number;
  jitterPenaltyMultiplier: number;
};

export function textureProfile(texture: RepertoireTexture): TextureProfile {
  switch (texture) {
    case "drone":
      return {
        tempoSpreadMultiplier: 0.45,
        peerCouplingMultiplier: 0.45,
        clickTrackMultiplier: 0.25,
        latencyBudgetMultiplier: 1.8,
        jitterPenaltyMultiplier: 0.5,
      };
    case "call-response":
      return {
        tempoSpreadMultiplier: 0.75,
        peerCouplingMultiplier: 0.7,
        clickTrackMultiplier: 0.6,
        latencyBudgetMultiplier: 1.35,
        jitterPenaltyMultiplier: 0.7,
      };
    case "rubato":
      return {
        tempoSpreadMultiplier: 0.55,
        peerCouplingMultiplier: 0.65,
        clickTrackMultiplier: 0.25,
        latencyBudgetMultiplier: 1.45,
        jitterPenaltyMultiplier: 0.8,
      };
    case "dense-rhythm":
      return {
        tempoSpreadMultiplier: 1.25,
        peerCouplingMultiplier: 1.2,
        clickTrackMultiplier: 1.25,
        latencyBudgetMultiplier: 0.62,
        jitterPenaltyMultiplier: 1.7,
      };
    case "pulse":
      return {
        tempoSpreadMultiplier: 1,
        peerCouplingMultiplier: 1,
        clickTrackMultiplier: 1,
        latencyBudgetMultiplier: 1,
        jitterPenaltyMultiplier: 1,
      };
  }
}

export function assertValidEnsembleConfig(config: EnsembleConfig): void {
  assertBoundedNumber("musicianCount", config.musicianCount, ensembleConfigBounds.musicianCount);
  if (!Number.isInteger(config.musicianCount)) {
    throw new RangeError("musicianCount must be an integer.");
  }

  assertBoundedNumber("tempoBpm", config.tempoBpm, ensembleConfigBounds.tempoBpm);
  assertBoundedNumber(
    "tempoSpreadBpm",
    config.tempoSpreadBpm,
    ensembleConfigBounds.tempoSpreadBpm,
  );
  assertBoundedNumber(
    "couplingStrength",
    config.couplingStrength,
    ensembleConfigBounds.couplingStrength,
  );
  assertBoundedNumber("latencySeconds", config.latencySeconds, ensembleConfigBounds.latencySeconds);
  assertBoundedNumber("jitterSeconds", config.jitterSeconds, ensembleConfigBounds.jitterSeconds);
  assertBoundedNumber(
    "clickTrackStrength",
    config.clickTrackStrength,
    ensembleConfigBounds.clickTrackStrength,
  );

  if (!validTopologyValues.has(config.topology)) {
    throw new RangeError("topology must be a supported ensemble topology.");
  }
  if (!validTextureValues.has(config.repertoireTexture)) {
    throw new RangeError("repertoireTexture must be a supported repertoire texture.");
  }
}

function assertBoundedNumber(
  name: string,
  value: number,
  bounds: { min: number; max: number },
): void {
  if (!Number.isFinite(value) || value < bounds.min || value > bounds.max) {
    throw new RangeError(`${name} must be a finite number from ${bounds.min} to ${bounds.max}.`);
  }
}

const validTopologyValues = new Set<Topology>([
  "all-to-all",
  "leader-follower",
  "sections",
  "click-track",
]);

const validTextureValues = new Set<RepertoireTexture>([
  "pulse",
  "drone",
  "call-response",
  "rubato",
  "dense-rhythm",
]);
