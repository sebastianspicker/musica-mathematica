import type {
  FactorValue,
  LabEvaluation,
  ObservableRecord,
  TraceAxes,
  TracePoint,
} from "./types";

export const MODEL_PROVENANCE = {
  source: "model" as const,
  calibration: "uncalibrated" as const,
  method: "Deterministic browser model; no audio measurement",
};

export const SYNTHETIC_PROVENANCE = {
  source: "synthetic" as const,
  calibration: "uncalibrated" as const,
  method: "Deterministic synthetic fixture; no raw audio retained",
};

export function observable({
  id,
  label,
  value,
  unit,
  claimId = "model.deterministic",
  precision = 2,
  aggregation = "instantaneous",
}: Readonly<{
  id: string;
  label: string;
  value: number | string;
  unit: string | null;
  claimId?: string;
  precision?: number;
  aggregation?: ObservableRecord["aggregation"];
}>): ObservableRecord {
  return { id, label, value, unit, claimId, precision, aggregation };
}

export function observableValues(...values: readonly [
  id: string,
  label: string,
  value: number | string,
  unit: string | null,
  claimId?: string,
  precision?: number,
  aggregation?: ObservableRecord["aggregation"],
]): ObservableRecord {
  const [id, label, value, unit, claimId, precision, aggregation] = values;
  return observable({ id, label, value, unit, claimId, precision, aggregation });
}

type ResultInput = Readonly<{
  headline: string;
  result: string;
  observables: readonly ObservableRecord[];
  trace: readonly TracePoint[];
  visualKind: LabEvaluation["visualKind"];
  annotation: string;
  traceAxes: TraceAxes;
  provenance?: LabEvaluation["provenance"];
}>;

export function result(input: ResultInput): LabEvaluation {
  const {
    headline,
    result: resultText,
    observables,
    trace,
    visualKind,
    annotation,
    traceAxes,
    provenance = MODEL_PROVENANCE,
  } = input;
  return { headline, result: resultText, observables, trace, traceAxes, visualKind, annotation, provenance };
}

export function resultValues(...values: readonly [
  headline: string,
  result: string,
  observables: readonly ObservableRecord[],
  trace: readonly TracePoint[],
  visualKind: LabEvaluation["visualKind"],
  annotation: string,
  traceAxes: TraceAxes,
  provenance?: LabEvaluation["provenance"],
]): LabEvaluation {
  const [headline, resultText, observables, trace, visualKind, annotation, traceAxes, provenance] = values;
  return result({ headline, result: resultText, observables, trace, visualKind, annotation, traceAxes, provenance });
}

export function axes(xLabel: string, xUnit: string | null, yLabel: string, yUnit: string | null): TraceAxes {
  return { x: { label: xLabel, unit: xUnit }, y: { label: yLabel, unit: yUnit } };
}

export function numberFactor(factors: Readonly<Record<string, FactorValue>>, id: string): number {
  const value = factors[id];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`Factor ${id} must be a finite number.`);
  }
  return value;
}

export function stringFactor(factors: Readonly<Record<string, FactorValue>>, id: string): string {
  const value = factors[id];
  if (typeof value !== "string") throw new TypeError(`Factor ${id} must be a string.`);
  return value;
}

export function booleanFactor(factors: Readonly<Record<string, FactorValue>>, id: string): boolean {
  const value = factors[id];
  if (typeof value !== "boolean") throw new TypeError(`Factor ${id} must be a boolean.`);
  return value;
}

export function signed(value: number, precision: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(precision)}`;
}
