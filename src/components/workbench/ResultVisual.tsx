import { useId, type ReactElement } from "react";
import type {
  LabEvaluation,
  ObservableRecord,
  TracePoint,
} from "../../labs/types";
import { claimById, evidenceLabels } from "../../learning/evidence";

export type ResultVisualProps = Readonly<{
  evaluation: LabEvaluation;
}>;

const visualLabels: Readonly<Record<LabEvaluation["visualKind"], string>> = {
  phase: "Circular phase result",
  pulse: "Pulse and onset result",
  spectrum: "Frequency-domain result",
  pitch: "Pitch-space result",
  network: "Coupled-network result",
  distribution: "Distribution result",
  measurement: "Measurement result",
};

const linePatternLabels = ["solid line", "long dashed line", "dotted line", "dash-dot line"] as const;
const linePatterns = [undefined, "10 7", "2 5", "12 4 2 4"] as const;

export function ResultVisual({ evaluation }: ResultVisualProps): ReactElement {
  const instanceId = useId();
  const series = groupTraceBySeries(evaluation.trace);
  const plot = plotGeometry(evaluation.trace);
  const claimKindLabel = claimKindFromObservables(evaluation.observables);

  return (
    <figure className={`mm-result-visual mm-result-visual--${evaluation.visualKind}`}>
      <figcaption className="mm-result-visual__caption">
        <div className="mm-result-visual__meta">
          <span className="mm-result-visual__kind">
            {evaluation.headline || "Figure · Mathematical result"}
          </span>
          {claimKindLabel ? (
            <span className="mm-result-visual__claim-pill">{claimKindLabel}</span>
          ) : null}
        </div>
        <h2 id={`${instanceId}-heading`}>{evaluation.result}</h2>
      </figcaption>

      <ResultBody evaluation={evaluation} instanceId={instanceId} plot={plot} series={series} />
      <ResultProvenance evaluation={evaluation} />
    </figure>
  );
}

type TraceSeries = ReturnType<typeof groupTraceBySeries>;
type PlotGeometry = NonNullable<ReturnType<typeof plotGeometry>>;

function ResultBody({ evaluation, instanceId, plot, series }: Readonly<{ evaluation: LabEvaluation; instanceId: string; plot: PlotGeometry | null; series: TraceSeries }>): ReactElement {
  return <div className="mm-result-visual__body">
    {series.length > 0 && plot ? <TracePlot evaluation={evaluation} instanceId={instanceId} plot={plot} series={series} /> : <p className="mm-result-visual__empty">No trace is available for this result.</p>}
    <ObservableTable observables={evaluation.observables} />
  </div>;
}

function TracePlot({ evaluation, instanceId, plot, series }: Readonly<{ evaluation: LabEvaluation; instanceId: string; plot: PlotGeometry; series: TraceSeries }>): ReactElement {
  const { x: xAxis, y: yAxis } = evaluation.traceAxes;
  return <div className="mm-result-visual__plot">
    <svg aria-labelledby={`${instanceId}-heading ${instanceId}-description`} className="mm-result-visual__svg" role="img" viewBox="0 0 640 280">
      <desc id={`${instanceId}-description`}>{visualLabels[evaluation.visualKind]}. {axisRangeDescription(xAxis.label, xAxis.unit, plot.minX, plot.maxX)}. {axisRangeDescription(yAxis.label, yAxis.unit, plot.minY, plot.maxY)}. Series are also identified by line pattern and text.</desc>
      <line className="mm-result-visual__axis" x1="54" x2="620" y1="226" y2="226" />
      <line className="mm-result-visual__axis" x1="54" x2="54" y1="18" y2="226" />
      {series.map((item, index) => <TraceLine index={index} item={item} key={item.name} plot={plot} />)}
      <AxisLabels plot={plot} xAxis={xAxis} yAxis={yAxis} />
    </svg>
    <TraceLegend series={series} />
  </div>;
}

function TraceLine({ index, item, plot }: Readonly<{ index: number; item: TraceSeries[number]; plot: PlotGeometry }>): ReactElement {
  const points = item.points.map((point) => `${scale(point.x, plot.minX, plot.maxX, 54, 620)},${scale(point.y, plot.minY, plot.maxY, 226, 18)}`).join(" ");
  const point = item.points.at(0);
  return <g className={`mm-result-visual__series mm-result-visual__series--${index % 4}`}>
    <polyline fill="none" points={points} stroke="currentColor" strokeDasharray={linePatterns[index % linePatterns.length]} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    {item.points.length === 1 && point ? <circle cx={scale(point.x, plot.minX, plot.maxX, 54, 620)} cy={scale(point.y, plot.minY, plot.maxY, 226, 18)} fill="currentColor" r="4" /> : null}
  </g>;
}

function AxisLabels({ plot, xAxis, yAxis }: Readonly<{ plot: PlotGeometry; xAxis: LabEvaluation["traceAxes"]["x"]; yAxis: LabEvaluation["traceAxes"]["y"] }>): ReactElement {
  return <>
    <text className="mm-result-visual__axis-label" x="54" y="248">{formatAxisValue(plot.minX, xAxis.unit)}</text><text className="mm-result-visual__axis-label" textAnchor="end" x="620" y="248">{formatAxisValue(plot.maxX, xAxis.unit)}</text><text className="mm-result-visual__axis-label" x="8" y="24">{formatAxisValue(plot.maxY, yAxis.unit)}</text><text className="mm-result-visual__axis-label" x="8" y="226">{formatAxisValue(plot.minY, yAxis.unit)}</text><text className="mm-result-visual__axis-label" textAnchor="middle" x="337" y="258">{formatAxisLabel(xAxis.label, xAxis.unit)}</text><text className="mm-result-visual__axis-label" textAnchor="middle" transform="translate(16 122) rotate(-90)">{formatAxisLabel(yAxis.label, yAxis.unit)}</text>
  </>;
}

function TraceLegend({ series }: Readonly<{ series: TraceSeries }>): ReactElement {
  return <ul className={series.length === 1 ? "mm-result-visual__legend mm-result-visual__legend--single" : "mm-result-visual__legend"} aria-label="Trace series">{series.map((item, index) => <li key={item.name}><span className={`mm-result-visual__swatch mm-result-visual__swatch--${index % 4}`} aria-hidden="true" /><span>{item.name} · {linePatternLabels[index % linePatternLabels.length]}</span></li>)}</ul>;
}

function ResultProvenance({ evaluation }: Readonly<{ evaluation: LabEvaluation }>): ReactElement {
  const { provenance } = evaluation;
  return <dl className="mm-result-visual__provenance">
    <div><dt>Source</dt><dd>{formatSource(provenance.source)}</dd></div><div><dt>Calibration</dt><dd>{provenance.calibration}</dd></div><div><dt>Method</dt><dd>{provenance.method}</dd></div>
    <OptionalProvenance label="Sample rate" suffix=" Hz" value={provenance.sampleRateHz} /><OptionalProvenance label="Frame size" suffix=" samples" value={provenance.frameSize} /><OptionalProvenance label="Hop size" suffix=" samples" value={provenance.hopSize} /><OptionalProvenance label="Dropped frames" value={provenance.droppedFrames} />
  </dl>;
}

function OptionalProvenance({ label, suffix = "", value }: Readonly<{ label: string; suffix?: string; value: number | undefined }>): ReactElement | null {
  return value === undefined ? null : <div><dt>{label}</dt><dd>{value}{suffix}</dd></div>;
}

function claimKindFromObservables(observables: readonly ObservableRecord[]): string | null {
  const claimId = observables[0]?.claimId;
  if (!claimId) return null;
  const claim = claimById(claimId);
  return claim ? evidenceLabels[claim.kind] : null;
}

function ObservableTable({ observables }: Readonly<{ observables: readonly ObservableRecord[] }>): ReactElement {
  if (observables.length === 0) {
    return <p className="mm-result-visual__empty">No summary observables are available.</p>;
  }

  return (
    <section className="mm-result-visual__metrics" aria-labelledby="mm-result-metrics-heading">
      <h3 id="mm-result-metrics-heading">Computed or observed quantities</h3>
      <dl>
        {observables.map((observable) => (
          <div key={observable.id}>
            <dt>{observable.label}</dt>
            <dd>{formatObservable(observable)}</dd>
            <span>{formatAggregation(observable.aggregation)}</span>
          </div>
        ))}
      </dl>
    </section>
  );
}

function groupTraceBySeries(trace: readonly TracePoint[]): readonly Readonly<{
  name: string;
  points: readonly TracePoint[];
}>[] {
  const groups = new Map<string, TracePoint[]>();
  for (const point of trace) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const points = groups.get(point.series) ?? [];
    points.push(point);
    groups.set(point.series, points);
  }
  return [...groups].map(([name, points]) => ({ name, points }));
}

function plotGeometry(trace: readonly TracePoint[]): Readonly<{
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}> | null {
  const points = trace.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (points.length === 0) return null;
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const xRange = expandRange({ minimum: Math.min(...xValues), maximum: Math.max(...xValues) });
  const yRange = expandRange({ minimum: Math.min(...yValues), maximum: Math.max(...yValues) });
  return { minX: xRange.minimum, maxX: xRange.maximum, minY: yRange.minimum, maxY: yRange.maximum };
}

function expandRange({ minimum, maximum }: Readonly<{ minimum: number; maximum: number }>): Readonly<{ minimum: number; maximum: number }> {
  if (minimum !== maximum) return { minimum, maximum };
  const padding = Math.max(Math.abs(minimum) * 0.05, 1);
  return { minimum: minimum - padding, maximum: maximum + padding };
}

function scale(value: number, minimum: number, maximum: number, start: number, end: number): number {
  return start + ((value - minimum) / (maximum - minimum)) * (end - start);
}

function formatObservable(observable: ObservableRecord): string {
  const value = typeof observable.value === "number"
    ? formatValue(observable.value, observable.precision)
    : observable.value;
  return observable.unit ? `${value} ${observable.unit}` : value;
}

function formatValue(value: number, precision?: number): string {
  if (precision !== undefined) return value.toFixed(precision);
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatAxisLabel(label: string, unit: string | null): string {
  return unit ? `${label} (${unit})` : label;
}

function formatAxisValue(value: number, unit: string | null): string {
  const formatted = formatValue(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function axisRangeDescription(label: string, unit: string | null, minimum: number, maximum: number): string {
  return `${formatAxisLabel(label, unit)} ranges from ${formatAxisValue(minimum, unit)} to ${formatAxisValue(maximum, unit)}`;
}

function formatAggregation(aggregation: ObservableRecord["aggregation"]): string {
  return aggregation.replaceAll("-", " ");
}

function formatSource(source: LabEvaluation["provenance"]["source"]): string {
  switch (source) {
    case "model": return "Computed model";
    case "synthetic": return "Synthetic signal";
    case "microphone": return "Microphone segment";
    case "file": return "Audio file segment";
  }
}
