import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EvaluationOutput } from "../../curriculum/contracts";
import { ResultVisual } from "./ResultVisual";

const evaluation: EvaluationOutput = {
  headline: "Euclidean rhythm",
  result: "1 0 0 1 0 0 1 0",
  observables: [],
  trace: [],
  traceAxes: { x: { label: "Step", unit: null }, y: { label: "Onset", unit: null } },
  visualKind: "pulse",
  annotation: "",
  provenance: { source: "model", calibration: "uncalibrated", method: "test" },
};

describe("result heading", () => {
  it("does not split an onset pattern into a value and a unit", () => {
    const markup = renderToStaticMarkup(<ResultVisual evaluation={evaluation} />);
    expect(markup).not.toContain("mm-result-visual__unit");
  });

  it("still splits a number from its unit", () => {
    const markup = renderToStaticMarkup(<ResultVisual evaluation={{ ...evaluation, result: "0.500 s" }} />);
    expect(markup).toContain('<span class="mm-result-visual__unit">s</span>');
  });

  it("stays fast on long whitespace runs", () => {
    const started = performance.now();
    renderToStaticMarkup(<ResultVisual evaluation={{ ...evaluation, result: `1${" ".repeat(40_000)}\n` }} />);
    expect(performance.now() - started).toBeLessThan(200);
  });
});
