import type { ReactElement } from "react";
import type { FactorValue, LessonDefinition, ObservableRecord } from "../../curriculum/contracts";
import { formatFactorValue, formatObservable } from "../format";

export function NotebookReadings({ lesson, factors, observables = [], factorMode = "all" }: Readonly<{
  lesson: LessonDefinition;
  factorMode?: "all" | "primary" | "context";
  factors?: Readonly<Record<string, FactorValue>>;
  observables?: readonly ObservableRecord[];
}>): ReactElement {
  return <dl className={`mm-notebook-readings${factorMode === "context" ? " mm-notebook-context" : ""}`}>
    {factors ? (factorMode === "primary" ? lesson.factors.slice(0, 1) : factorMode === "context" ? lesson.factors.slice(1) : lesson.factors).map((factor) => <div key={factor.id}><dt>{factor.label}</dt><dd>{formatFactorValue(factors[factor.id], factor)}</dd></div>) : null}
    {observables.map((observable) => <div key={observable.id}><dt>{observable.label}</dt><dd>{formatObservable(observable)}</dd></div>)}
  </dl>;
}
