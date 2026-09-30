import type { FactorDefinition, FactorValue, ObservableRecord } from "../curriculum/contracts";

export function formatNumber(value: number, precision?: number): string {
  if (precision !== undefined) return value.toFixed(precision);
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatObservable(observable: ObservableRecord): string {
  const value = typeof observable.value === "number"
    ? formatNumber(observable.value, observable.precision)
    : observable.value;
  return observable.unit ? `${value} ${observable.unit}` : value;
}

export function formatRecordedObservable(observable: ObservableRecord | undefined): string {
  return observable ? formatObservable(observable) : "Not recorded";
}

export function formatFactorValue(value: FactorValue | undefined, definition?: FactorDefinition): string {
  if (value === undefined) return "Not recorded";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "string") {
    if (definition?.kind === "select") {
      return definition.options.find((option) => option.value === value)?.label ?? value;
    }
    return value;
  }
  const formatted = formatNumber(value);
  return definition?.kind === "number" && definition.unit
    ? `${formatted} ${definition.unit}`
    : formatted;
}
