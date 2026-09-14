import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { LessonDefinition, NumberFactor } from "../../curriculum/contracts";
import { FactorInspector, stepNumberFactorValue } from "./FactorInspector";

const factor: NumberFactor = { id: "number", label: "Test value", kind: "number", min: 0, max: 1, step: 0.1, defaultValue: 0.5, help: "Test range" };
const lesson: LessonDefinition = {
  id: "test-lesson", domainId: "phase-proportion", number: 1, level: "foundation", title: "Test lesson", shortTitle: "Test", question: "What changes?", objective: "Compare values", equation: "x", equationCaption: "Test value", predictionPrompt: "Predict", experimentPrompt: "Experiment", interpretationPrompt: "Explain", transferPrompt: "Transfer", inputModes: ["synthetic"], factors: [factor],
  claimIds: [], sourceIds: [], protocol: { id: "test-protocol", deterministic: true, durationSeconds: 1 },
};
it("steps precisely and clamps at the factor bounds", () => {
  expect(stepNumberFactorValue(0.2, factor, 1)).toBe(0.3);
  expect(stepNumberFactorValue(1, factor, 1)).toBe(1);
  expect(stepNumberFactorValue(0, factor, -1)).toBe(0);
});
it("provides labelled step controls and native recording constraints", () => {
  const markup = renderToStaticMarkup(<FactorInspector lesson={lesson} values={{ number: 0.5 }} inputMode="synthetic" onFactorChange={() => undefined} onInputModeChange={() => undefined} />);
  expect(markup).toContain('aria-label="Decrease Test value"');
  expect(markup).toContain('aria-label="Increase Test value"');
  expect(markup).toContain('min="0"');
  expect(markup).toContain('max="1"');
  expect(markup).toContain('step="0.1"');
  expect(markup).toContain('required=""');
});
