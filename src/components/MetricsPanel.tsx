import type { ReactElement } from "react";
import {
  type EnsembleConfig,
  type EnsembleMetrics,
  modelLatencyBudgetRatio,
  modelLatencyBudgetStatus,
} from "../simulation/ensemble";
import { MathText } from "./MathText";

type MetricsPanelProps = {
  config: EnsembleConfig;
  metrics: EnsembleMetrics;
  suggestions: readonly string[];
};

const statusLabels: Record<ReturnType<typeof modelLatencyBudgetStatus>, string> = {
  plausible: "Plausible",
  fragile: "Fragile",
  unstable: "Likely unstable",
};

export function MetricsPanel({
  config,
  metrics,
  suggestions,
}: MetricsPanelProps): ReactElement {
  const budgetRatio = modelLatencyBudgetRatio(config, metrics);
  const status = modelLatencyBudgetStatus(config, metrics);

  return (
    <section className="metrics-panel" aria-label="Ensemble metrics">
      <h2>Transfer to Practice</h2>
      <dl className="metric-grid">
        <div>
          <dt>
            <span className="metric-label">
              Coherence <MathText label="r" latex="r" />
            </span>
          </dt>
          <dd>{metrics.coherence.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Timing error</dt>
          <dd>{metrics.timingErrorMs.toFixed(0)} ms</dd>
        </div>
        <div>
          <dt>Model delay budget</dt>
          <dd>{(metrics.modelLatencyBudgetSeconds * 1000).toFixed(0)} ms</dd>
        </div>
        <div>
          <dt>Peer-coupling share</dt>
          <dd>{(metrics.peerCouplingShare * 100).toFixed(0)}%</dd>
        </div>
      </dl>
      <section className={`latency-budget ${status}`} aria-label="Model delay budget explanation">
        <div>
          <strong>{statusLabels[status]}</strong>
          <span>{Math.round(budgetRatio * 100)}% of budget used</span>
        </div>
        <p>
          At {config.tempoBpm} BPM, one beat lasts {Math.round(60000 / config.tempoBpm)} ms.
          Delayed-coupling theory predicts less tolerance at faster tempi because the same
          delay occupies more phase of the beat. This is an idealized phase budget, not an
          empirical safety threshold. {textureLabel(config.repertoireTexture)} changes the
          model budget because its musical texture changes how much simultaneity matters.
        </p>
        <p>
          For tight synchronous rhythmic material, networked music systems often target roughly
          20-30 ms one-way latency. Empirical tolerance is task-dependent: tempo, instrument
          attack, texture, monitoring, musician strategy, and jitter can move the practical
          boundary substantially. Jitter is modeled as a separate heuristic risk because it
          forces buffering and weakens reliable feedback.
        </p>
      </section>
      <ul className="suggestions">
        {suggestions.map((suggestion) => (
          <li key={suggestion}>{suggestion}</li>
        ))}
      </ul>
    </section>
  );
}

function textureLabel(texture: EnsembleConfig["repertoireTexture"]): string {
  switch (texture) {
    case "dense-rhythm":
      return "Dense rhythmic material";
    case "call-response":
      return "Call-response material";
    case "rubato":
      return "Rubato material";
    case "drone":
      return "Drone material";
    case "pulse":
      return "Pulse-based material";
  }
}
