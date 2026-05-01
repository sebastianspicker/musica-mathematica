import type { ReactElement } from "react";
import type { MetricPoint } from "../App";

type TimingPlotProps = {
  points: readonly MetricPoint[];
};

export function TimingPlot({ points }: TimingPlotProps): ReactElement {
  const width = 520;
  const height = 180;
  const coherencePath = pathFor(points, width, height, "coherence");
  const errorPath = pathFor(points, width, height, "timingErrorMs");

  return (
    <section className="plot-panel" aria-label="Coherence and timing plot">
      <h2>Manipulate</h2>
      <svg role="img" viewBox={`0 0 ${width} ${height}`}>
        <title>Recent coherence and timing-error history</title>
        <line className="plot-grid" x1="0" x2={width} y1={height - 24} y2={height - 24} />
        <path className="coherence-line" d={coherencePath} />
        <path className="error-line" d={errorPath} />
      </svg>
      <div className="legend">
        <span className="coherence-key">Coherence</span>
        <span className="error-key">Timing error</span>
      </div>
    </section>
  );
}

function pathFor(
  points: readonly MetricPoint[],
  width: number,
  height: number,
  key: "coherence" | "timingErrorMs",
): string {
  if (points.length < 2) {
    return "";
  }

  const maxError = Math.max(120, ...points.map((point) => point.timingErrorMs));
  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const normalized =
        key === "coherence" ? 1 - point.coherence : Math.min(1, point.timingErrorMs / maxError);
      const y = 16 + normalized * (height - 40);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
