import { useId, type ReactElement } from "react";
import type {
  FactorDefinition,
  FactorValue,
  LabLesson,
  ObservableRecord,
  TrialSnapshotV2,
} from "../../labs/types";

export type ComparisonTableProps = Readonly<{
  lesson: LabLesson;
  trials: readonly TrialSnapshotV2[];
}>;

export function ComparisonTable({ lesson, trials }: ComparisonTableProps): ReactElement {
  const headingId = useId();
  const pair = trials.slice(-2);

  if (pair.length < 2) {
    return (
      <section className="mm-comparison-table mm-comparison-table--empty" aria-labelledby={headingId}>
        <h2 id={headingId}>Run A / Run B</h2>
        <p>Record two runs to compare controlled factors and descriptive observables.</p>
      </section>
    );
  }

  const [left, right] = pair;
  const factorIds = orderedFactorIds(lesson.factors, left.factors, right.factors);
  const changedFactorIds = factorIds.filter(
    (id) => !factorValuesEqual(left.factors[id], right.factors[id]),
  );
  const observableIds = unique([
    ...left.observables.map((observable) => observable.id),
    ...right.observables.map((observable) => observable.id),
  ]);
  const primaryFactorId = changedFactorIds[0] ?? factorIds[0];
  const primaryFactor = lesson.factors.find((factor) => factor.id === primaryFactorId);
  const primaryObservableId = observableIds[0];
  const leftObservable = left.observables.find((item) => item.id === primaryObservableId);
  const rightObservable = right.observables.find((item) => item.id === primaryObservableId);

  return (
    <section className="mm-comparison-table" aria-labelledby={headingId}>
      <div className="mm-comparison-table__heading">
        <h2 id={headingId}>Controlled comparison</h2>
        <p>
          {changedFactorIds.length === 0
            ? "No factor changed between the two latest runs."
            : `Changed factors: ${changedFactorIds.map((id) => factorLabel(lesson.factors, id)).join(", ")}.`}
        </p>
      </div>

      <div className="mm-comparison-summary" aria-label="Latest controlled comparison summary">
        <div><span>Run A</span><strong>{formatFactorValue(left.factors[primaryFactorId], primaryFactor)}</strong><small>{formatObservable(leftObservable)}</small></div>
        <div className="mm-comparison-summary__change"><span>{factorLabel(lesson.factors, primaryFactorId)}</span><strong>{changedFactorIds.includes(primaryFactorId) ? "Changed" : "Held constant"}</strong><small>{heldFactorSummary(factorIds, changedFactorIds, lesson.factors)}</small></div>
        <div><span>Run B</span><strong>{formatFactorValue(right.factors[primaryFactorId], primaryFactor)}</strong><small>{formatObservable(rightObservable)}</small></div>
      </div>

      <details className="mm-comparison-table__details">
        <summary>View detailed factor and observable tables</summary>
        <div className="mm-comparison-table__scroll" role="region" aria-label="Factors in the two latest runs" tabIndex={0}>
          <table>
          <caption>Factors in the two latest runs</caption>
          <thead>
            <tr>
              <th scope="col">Factor</th>
              <th scope="col">Run A · {left.id}</th>
              <th scope="col">Run B · {right.id}</th>
              <th scope="col">Comparison</th>
            </tr>
          </thead>
          <tbody>
            {factorIds.map((id) => {
              const changed = changedFactorIds.includes(id);
              const definition = lesson.factors.find((factor) => factor.id === id);
              return (
                <tr className={changed ? "mm-comparison-table__changed" : undefined} key={id}>
                  <th scope="row">{factorLabel(lesson.factors, id)}</th>
                  <td>{formatFactorValue(left.factors[id], definition)}</td>
                  <td>{formatFactorValue(right.factors[id], definition)}</td>
                  <td>{changed ? "Changed" : "Held constant"}</td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>

        <div className="mm-comparison-table__scroll" role="region" aria-label="Descriptive observables in the two latest runs" tabIndex={0}>
          <table>
          <caption>Descriptive observables in the two latest runs</caption>
          <thead>
            <tr><th scope="col">Observable</th><th scope="col">Run A</th><th scope="col">Run B</th></tr>
          </thead>
          <tbody>
            {observableIds.map((id) => {
              const leftObservable = left.observables.find((item) => item.id === id);
              const rightObservable = right.observables.find((item) => item.id === id);
              return (
                <tr key={id}>
                  <th scope="row">{leftObservable?.label ?? rightObservable?.label ?? id}</th>
                  <td>{formatObservable(leftObservable)}</td>
                  <td>{formatObservable(rightObservable)}</td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </details>

      <p className="mm-comparison-table__boundary">
        This is a descriptive comparison, not a score or grade.
      </p>
    </section>
  );
}

function heldFactorSummary(
  factorIds: readonly string[],
  changedFactorIds: readonly string[],
  definitions: readonly FactorDefinition[],
): string {
  const held = factorIds.filter((id) => !changedFactorIds.includes(id));
  if (held.length === 0) return "No factor held constant";
  return `${held.map((id) => factorLabel(definitions, id)).join(", ")} held constant`;
}

function orderedFactorIds(
  definitions: readonly FactorDefinition[],
  left: Readonly<Record<string, FactorValue>>,
  right: Readonly<Record<string, FactorValue>>,
): readonly string[] {
  return unique([
    ...definitions.map((factor) => factor.id),
    ...Object.keys(left),
    ...Object.keys(right),
  ]);
}

function factorLabel(definitions: readonly FactorDefinition[], id: string): string {
  return definitions.find((factor) => factor.id === id)?.label ?? id;
}

function factorValuesEqual(left: FactorValue | undefined, right: FactorValue | undefined): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) < 1e-9;
  }
  return left === right;
}

function formatFactorValue(value: FactorValue | undefined, definition?: FactorDefinition): string {
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

function formatObservable(observable: ObservableRecord | undefined): string {
  if (!observable) return "Not recorded";
  const value = typeof observable.value === "number"
    ? formatNumber(observable.value, observable.precision)
    : observable.value;
  return observable.unit ? `${value} ${observable.unit}` : value;
}

function formatNumber(value: number, precision?: number): string {
  if (precision !== undefined) return value.toFixed(precision);
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
