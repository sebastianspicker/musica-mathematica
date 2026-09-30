import { memo, useId, type ReactElement } from "react";
import type {
  FactorDefinition,
  FactorValue,
  ObservableRecord,
  LessonDefinition,
} from "../../curriculum/contracts";
import { changedFactorIds as changedFactorIdsBetween } from "../../learning/inquiry/comparison";
import type { TrialSnapshotV2 } from "../../learning/portfolio/schema";
import { formatFactorValue, formatNumber, formatRecordedObservable } from "../format";

export type ComparisonTableProps = Readonly<{
  lesson: LessonDefinition;
  trials: readonly TrialSnapshotV2[];
}>;

export const ComparisonTable = memo(function ComparisonTable({ lesson, trials }: ComparisonTableProps): ReactElement {
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
  const changedFactorIds = changedFactorIdsBetween(factorIds, left.factors, right.factors);
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



      <ComparisonDetails
        summary={<ComparisonSummary
        changedFactorIds={changedFactorIds}
        factorIds={factorIds}
        leftFactors={leftFactors}
        leftObservable={leftObservable}
        primaryFactor={primaryFactor}
        primaryFactorId={primaryFactorId}
        rightFactors={rightFactors}
        rightObservable={rightObservable}
        definitions={lesson.factors}
      />}
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
});

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
  const leftValue = leftFactors.get(primaryFactorId);
  const rightValue = rightFactors.get(primaryFactorId);
  const numericDelta = factorDelta(leftValue, rightValue, primaryFactor);
  const changed = changedFactorIds.includes(primaryFactorId);

  return <div className="mm-comparison-summary" aria-label="Latest controlled comparison summary">
    <div><span>Run A</span><strong>{formatFactorValue(leftValue, primaryFactor)}</strong><small>{formatRecordedObservable(leftObservable)}</small></div>
    <div className="mm-comparison-summary__change"><span>{factorLabel(definitions, primaryFactorId)} · {changed ? "changed factor" : "held constant"}</span><strong>{numericDelta ?? (changed ? "Changed" : "Held constant")}</strong><small>{heldFactorSummary(factorIds, changedFactorIds, definitions)}</small></div>
    <div><span>Run B</span><strong>{formatFactorValue(rightValue, primaryFactor)}</strong><small>{formatRecordedObservable(rightObservable)}</small></div>
  </div>;
}

type ComparisonDetailsProps = Readonly<{
  summary?: ReactElement;
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
  return <div className="mm-comparison-table__details">
    <ObservableComparisonTable left={props.left} observableIds={props.observableIds} right={props.right} />
    <details><summary>View all recorded factors</summary>{props.summary}<FactorComparisonTable {...props} /></details>
    {props.left.note || props.right.note ? <dl className="mm-notebook-trial-notes">
      {props.left.note ? <div><dt>Run A observation</dt><dd>{props.left.note}</dd></div> : null}
      {props.right.note ? <div><dt>Run B observation</dt><dd>{props.right.note}</dd></div> : null}
    </dl> : null}
  </div>;
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
    <td>{formatRecordedObservable(left)}</td>
    <td>{formatRecordedObservable(right)}</td>
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

function factorDelta(left: FactorValue | undefined, right: FactorValue | undefined, definition: FactorDefinition | undefined): string | null {
  if (definition?.kind !== "number" || typeof left !== "number" || typeof right !== "number") return null;
  const delta = right - left;
  const signed = `${delta >= 0 ? "+" : ""}${formatNumber(delta)}`;
  return definition.unit ? `${signed} ${definition.unit}` : signed;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
