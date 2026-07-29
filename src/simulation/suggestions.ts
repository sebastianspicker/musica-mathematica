import {
  type EnsembleConfig,
  type EnsembleMetrics,
  modelLatencyBudgetStatus,
  textureProfile,
} from "./ensemble";

function latencySuggestion(status: ReturnType<typeof modelLatencyBudgetStatus>): string {
  if (status === "unstable") {
    return "Model-based option: test a slower tempo, simpler density, or delayed response.";
  }
  if (status === "fragile") {
    return "Model-based option: test sparser pulse material or anticipatory entries.";
  }
  return "This configuration is within the model phase budget; real rehearsal fit still needs testing.";
}

export function rehearsalSuggestions(
  config: EnsembleConfig,
  metrics: EnsembleMetrics,
): string[] {
  const latencyStatus = modelLatencyBudgetStatus(config, metrics);
  const profile = textureProfile(config.repertoireTexture);
  return [
    latencySuggestion(latencyStatus),
    ...timingSuggestions(config),
    ...textureSuggestions(config, profile.latencyBudgetMultiplier),
    ...coordinationSuggestions(config, metrics),
  ];
}

const timingSuggestions = (config: EnsembleConfig): string[] => {
  const suggestions: string[] = [];
  if (config.jitterSeconds > 0.012) {
    suggestions.push("The jitter heuristic is high; test more buffering or lower texture density as hypotheses.");
  }
  return suggestions;
};

const textureSuggestions = (config: EnsembleConfig, latencyBudgetMultiplier: number): string[] => {
  const suggestions: string[] = [];
  if (config.repertoireTexture === "dense-rhythm" && latencyBudgetMultiplier < 1) {
    suggestions.push("Dense rhythmic material needs lower latency or clearer structural separation.");
  }
  if (config.repertoireTexture === "drone") {
    suggestions.push("Drone texture can tolerate more delay, but pulse salience and click usefulness are lower.");
  }
  return suggestions;
};

const coordinationSuggestions = (config: EnsembleConfig, metrics: EnsembleMetrics): string[] => {
  const suggestions: string[] = [];
  if (metrics.coherence < 0.55 && config.couplingStrength < 1) {
    suggestions.push("Increase listening cues: clearer attacks, smaller sections, or a temporary leader.");
  }
  if (config.clickTrackStrength > config.couplingStrength) {
    suggestions.push("The click improves precision but shifts adaptation away from peer coupling.");
  }
  if (config.topology === "sections") {
    suggestions.push("Section routing is useful when subgroups need tighter timing than the full ensemble.");
  }
  return suggestions;
};
