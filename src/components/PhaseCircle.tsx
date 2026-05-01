import type { ReactElement } from "react";
import type { EnsembleState } from "../simulation/ensemble";

type PhaseCircleProps = {
  state: EnsembleState;
};

export function PhaseCircle({ state }: PhaseCircleProps): ReactElement {
  const size = 360;
  const center = size / 2;
  const radius = 128;

  return (
    <section className="phase-panel" aria-label="Phase circle">
      <h2>Experience First</h2>
      <svg role="img" viewBox={`0 0 ${size} ${size}`}>
        <title>Phase circle showing each musician as a pulse oscillator</title>
        <circle className="phase-ring" cx={center} cy={center} r={radius} />
        <line className="phase-axis" x1={center} x2={center + radius} y1={center} y2={center} />
        {state.oscillators.map((oscillator, index) => {
          const x = center + Math.cos(oscillator.phase) * radius;
          const y = center + Math.sin(oscillator.phase) * radius;
          return (
            <g key={index}>
              <line className="phase-spoke" x1={center} x2={x} y1={center} y2={y} />
              <circle className="musician-dot" cx={x} cy={y} r={8} />
              <text className="musician-label" x={x + 12} y={y + 4}>
                {index + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
