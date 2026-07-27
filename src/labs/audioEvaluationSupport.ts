import type { TemporalHypotheses } from "../audio";
import type { AudioEvaluationSettings } from "./audioEvaluation";
import type { ObservableRecord } from "./types";

type MeterHypotheses = TemporalHypotheses["meterHypotheses"];
type MeterHypothesis = MeterHypotheses[number];
type MeterBias = AudioEvaluationSettings["meterBias"];
type ActiveMeterBias = Exclude<MeterBias, undefined | "mixed">;

export function formatAnalysisSettings(settings: AudioEvaluationSettings): string {
  const parts = [
    ...(settings.onsetSensitivity === undefined ? [] : [`onset sensitivity ${settings.onsetSensitivity.toFixed(2)}`]),
    ...(settings.meterBias === undefined ? [] : [`meter family ${settings.meterBias}`]),
  ];
  return parts.length === 0 ? "" : ` (${parts.join(", ")})`;
}

export function observed(
  id: string,
  label: string,
  value: number | string,
  unit: string | null,
): ObservableRecord {
  return { id, label, value, unit, aggregation: "distribution", claimId: "measurement.local", precision: 3 };
}

export function hypothesis(id: string, label: string, value: string): ObservableRecord {
  return { id, label, value, unit: null, aggregation: "distribution", claimId: "hypothesis.transcription" };
}

export function meanFinite(values: readonly number[]): number | null {
  const finite = values.filter(Number.isFinite);
  return finite.length === 0 ? null : finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

export function finiteLabel(value: number | null, precision: number): string {
  return value === null || !Number.isFinite(value) ? "below numerical floor" : value.toFixed(precision);
}

export function matchesMeterBias(hypothesis: MeterHypothesis, bias: ActiveMeterBias): boolean {
  const divisor = bias === "duple" ? 2 : 3;
  return hypothesis.beatsPerBar % divisor === 0;
}

export function selectMeterHypotheses(
  hypotheses: MeterHypotheses,
  bias: MeterBias,
): MeterHypotheses {
  if (bias === undefined || bias === "mixed") return hypotheses;
  const selected: MeterHypothesis[] = [];
  for (const candidate of hypotheses) {
    if (matchesMeterBias(candidate, bias)) selected.push(candidate);
  }
  return selected;
}
