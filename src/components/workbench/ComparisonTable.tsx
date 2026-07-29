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
  const leftFactors = new Map(Object.entries(left.factors));
  const rightFactors = new Map(Object.entries(right.factors));
  const factorIds = orderedFactorIds(lesson.factors, left.factors, right.factors);
  const changedFactorIds = factorIds.filter(
    (id) => !factorValuesEqual(leftFactors.get(id), rightFactors.get(id)),
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

      <ComparisonSummary
        changedFactorIds={changedFactorIds}
        factorIds={factorIds}
        leftFactors={leftFactors}
        leftObservable={leftObservable}
        primaryFactor={primaryFactor}
        primaryFactorId={primaryFactorId}
        rightFactors={rightFactors}
        rightObservable={rightObservable}
        definitions={lesson.factors}
      />

      <ComparisonDetails
        changedFactorIds={changedFactorIds}
        definitions={lesson.factors}
        factorIds={factorIds}
        left={left}
        leftFactors={leftFactors}
        observableIds={observableIds}
        right={right}
        rightFactors={rightFactors}
      />

      <p className="mm-comparison-table__boundary">
        This is a descriptive comparison, not a score or grade.
      </p>
    </section>
  );
}

type ComparisonSummaryProps = Readonly<{
  changedFactorIds: readonly string[];
  definitions: readonly FactorDefinition[];
  factorIds: readonly string[];
  leftFactors: ReadonlyMap<string, FactorValue>;
  leftObservable: ObservableRecord | undefined;
  primaryFactor: FactorDefinition | undefined;
  primaryFactorId: string;
  rightFactors: ReadonlyMap<string, FactorValue>;
  rightObservable: ObservableRecord | undefined;
}>;

function ComparisonSummary({ changedFactorIds, definitions, factorIds, leftFactors, leftObservable, primaryFactor, primaryFactorId, rightFactors, rightObservable }: ComparisonSummaryProps): ReactElement {
  return <div className="mm-comparison-summary" aria-label="Latest controlled comparison summary">
    <div><span>Run A</span><strong>{formatFactorValue(leftFactors.get(primaryFactorId), primaryFactor)}</strong><small>{formatObservable(leftObservable)}</small></div>
    <div className="mm-comparison-summary__change"><span>{factorLabel(definitions, primaryFactorId)}</span><strong>{changedFactorIds.includes(primaryFactorId) ? "Changed" : "Held constant"}</strong><small>{heldFactorSummary(factorIds, changedFactorIds, definitions)}</small></div>
    <div><span>Run B</span><strong>{formatFactorValue(rightFactors.get(primaryFactorId), primaryFactor)}</strong><small>{formatObservable(rightObservable)}</small></div>
  </div>;
}

type ComparisonDetailsProps = Readonly<{
  changedFactorIds: readonly string[];
  definitions: readonly FactorDefinition[];
  factorIds: readonly string[];
  left: TrialSnapshotV2;
  leftFactors: ReadonlyMap<string, FactorValue>;
  observableIds: readonly string[];
  right: TrialSnapshotV2;
  rightFactors: ReadonlyMap<string, FactorValue>;
}>;

function ComparisonDetails(props: ComparisonDetailsProps): ReactElement {
  return <details className="mm-comparison-table__details">
    <summary>View detailed factor and observable tables</summary>
    <FactorComparisonTable {...props} />
    <ObservableComparisonTable left={props.left} observableIds={props.observableIds} right={props.right} />
  </details>;
}

function FactorComparisonTable({ changedFactorIds, definitions, factorIds, left, leftFactors, right, rightFactors }: ComparisonDetailsProps): ReactElement {
  return <div className="mm-comparison-table__scroll" role="region" aria-label="Factors in the two latest runs" tabIndex={0}>
    <table>
      <caption>Factors in the two latest runs</caption>
      <thead><tr><th scope="col">Factor</th><th scope="col">Run A · {left.id}</th><th scope="col">Run B · {right.id}</th><th scope="col">Comparison</th></tr></thead>
      <tbody>{factorIds.map((id) => <FactorComparisonRow changed={changedFactorIds.includes(id)} definition={definitions.find((factor) => factor.id === id)} id={id} key={id} leftValue={leftFactors.get(id)} rightValue={rightFactors.get(id)} definitions={definitions} />)}</tbody>
    </table>
  </div>;
}

function FactorComparisonRow({ changed, definition, definitions, id, leftValue, rightValue }: Readonly<{ changed: boolean; definition: FactorDefinition | undefined; definitions: readonly FactorDefinition[]; id: string; leftValue: FactorValue | undefined; rightValue: FactorValue | undefined }>): ReactElement {
  return <tr className={changed ? "mm-comparison-table__changed" : undefined}>
    <th scope="row">{factorLabel(definitions, id)}</th>
    <td>{formatFactorValue(leftValue, definition)}</td>
    <td>{formatFactorValue(rightValue, definition)}</td>
    <td>{changed ? "Changed" : "Held constant"}</td>
  </tr>;
}

function ObservableComparisonTable({ left, observableIds, right }: Readonly<{ left: TrialSnapshotV2; observableIds: readonly string[]; right: TrialSnapshotV2 }>): ReactElement {
  return <div className="mm-comparison-table__scroll" role="region" aria-label="Descriptive observables in the two latest runs" tabIndex={0}>
    <table>
      <caption>Descriptive observables in the two latest runs</caption>
      <thead><tr><th scope="col">Observable</th><th scope="col">Run A</th><th scope="col">Run B</th></tr></thead>
      <tbody>{observableIds.map((id) => <ObservableComparisonRow id={id} key={id} left={left.observables.find((item) => item.id === id)} right={right.observables.find((item) => item.id === id)} />)}</tbody>
    </table>
  </div>;
}

function ObservableComparisonRow({ id, left, right }: Readonly<{ id: string; left: ObservableRecord | undefined; right: ObservableRecord | undefined }>): ReactElement {
  return <tr>
    <th scope="row">{left?.label ?? right?.label ?? id}</th>
    <td>{formatObservable(left)}</td>
    <td>{formatObservable(right)}</td>
  </tr>;
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
