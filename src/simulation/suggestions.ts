import {
  type EnsembleConfig,
  type EnsembleMetrics,
  modelLatencyBudgetRatio,
  textureProfile,
} from "./ensemble";

export function rehearsalSuggestions(
  config: EnsembleConfig,
  metrics: EnsembleMetrics,
): string[] {
  const suggestions: string[] = [];
  const latencyRatio = modelLatencyBudgetRatio(config, metrics);
  const profile = textureProfile(config.repertoireTexture);

  if (latencyRatio > 0.85) {
    suggestions.push("Slow the tempo, simplify rhythmic density, or compose with delayed response.");
  } else if (latencyRatio > 0.55) {
    suggestions.push("Keep pulse material sparse and rehearse anticipatory entries.");
  } else {
    suggestions.push("The model delay budget is plausible for peer-driven ensemble work.");
  }

  if (config.jitterSeconds > 0.012) {
    suggestions.push("Treat jitter as instability, not just delay. Increase buffers or reduce texture density.");
  }

  if (config.repertoireTexture === "dense-rhythm" && profile.latencyBudgetMultiplier < 1) {
    suggestions.push("Dense rhythmic material needs lower latency or clearer structural separation.");
  }

  if (config.repertoireTexture === "drone") {
    suggestions.push("Drone texture can tolerate more delay, but pulse salience and click usefulness are lower.");
  }

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
}
