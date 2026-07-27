import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultLabLesson, labCatalog } from "../../labs/catalog";
import {
  defaultFactorsFor,
  type LabEvaluation,
  type TrialSnapshotV2,
} from "../../labs/types";
import { ComparisonTable } from "./ComparisonTable";
import { CurriculumRail } from "./CurriculumRail";
import { EvidencePanel } from "./EvidencePanel";
import { EvidenceRail } from "./EvidenceRail";
import { FactorInspector, validNumberFactorValue } from "./FactorInspector";
import { LessonBrief } from "./LessonBrief";
import { ResultVisual } from "./ResultVisual";
import { recordingBlocker } from "./workbenchHelpers";

describe("mathematical music workbench components", () => {
  it("renders all curriculum routes and identifies the current lesson semantically", () => {
    const html = renderToStaticMarkup(
      <CurriculumRail
        activeLabId={defaultLabLesson.labId}
        activeLessonId={defaultLabLesson.id}
        domains={labCatalog}
      />,
    );

    expect(html).toContain('aria-label="Mathematical music curriculum"');
    expect(html.match(/mm-curriculum-rail__domain(?: |")/g)).toHaveLength(8);
    expect(html.match(/mm-curriculum-rail__lesson(?: |")/g)).toHaveLength(24);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("#/labs/phase-proportion/lessons/from-bpm-to-period");
    expect(html).toContain('<a class="mm-curriculum-rail__domain-heading" href="#/labs/ensemble-dynamics/lessons/lock-in-and-order">');
  });

  it("renders controlled factors, help text, and only the lesson input modes", () => {
    const html = renderToStaticMarkup(
      <FactorInspector
        inputMode="synthetic"
        lesson={defaultLabLesson}
        onFactorChange={() => undefined}
        onInputModeChange={() => undefined}
        values={defaultFactorsFor(defaultLabLesson)}
      />,
    );

    expect(html).toContain("Factor inspector");
    expect(html).toContain("Analysis source");
    expect(html).toContain("Synthetic signal");
    expect(html).toContain("Tempo");
    expect(html).toContain("Beats per minute.");
    expect(html).toContain('aria-describedby=');
  });

  it("rejects empty, non-finite, and out-of-domain number-factor commits", () => {
    const tempo = defaultLabLesson.factors.find((factor) => factor.id === "bpm");
    if (!tempo || tempo.kind !== "number") throw new Error("Default tempo factor missing");

    expect(validNumberFactorValue(Number.NaN, tempo)).toBeNull();
    expect(validNumberFactorValue(tempo.min - tempo.step, tempo)).toBeNull();
    expect(validNumberFactorValue(tempo.max + tempo.step, tempo)).toBeNull();
    expect(validNumberFactorValue(tempo.defaultValue, tempo)).toBe(tempo.defaultValue);
  });

  it("renders the selected inquiry stage as the current task", () => {
    const html = renderToStaticMarkup(<LessonBrief lesson={defaultLabLesson} stage="interpret" />);

    expect(html).toContain("Lab 1 · Lesson 1 · foundation");
    expect(html).toContain("Current task · Interpret");
    expect(html).toContain(defaultLabLesson.interpretationPrompt);
  });

  it("renders traces with non-color line labels, quantities, and provenance", () => {
    const evaluation: LabEvaluation = {
      headline: "Two periodicities",
      result: "The traces return together at x = 2.",
      visualKind: "pulse",
      trace: [
        { x: 0, y: 0, series: "Pulse A" },
        { x: 2, y: 1, series: "Pulse A" },
        { x: 0, y: 1, series: "Pulse B" },
        { x: 2, y: 0, series: "Pulse B" },
      ],
      traceAxes: {
        x: { label: "Cycle time", unit: "s" },
        y: { label: "Pulse state", unit: null },
      },
      observables: [{
        id: "return",
        label: "Return time",
        value: 2,
        unit: "s",
        aggregation: "instantaneous",
        claimId: "math.identity",
      }],
      annotation: "This exact lattice does not establish a perceived meter.",
      provenance: {
        source: "model",
        calibration: "uncalibrated",
        method: "Integer lattice",
      },
    };
    const html = renderToStaticMarkup(<ResultVisual evaluation={evaluation} />);

    expect(html).toContain('role="img"');
    expect(html).toContain("solid line");
    expect(html).toContain("long dashed line");
    expect(html).toContain("Cycle time (s)");
    expect(html).toContain("Pulse state ranges from");
    expect(html).not.toContain("Horizontal values range");
    expect(html).toContain("Computed or observed quantities");
    expect(html).toContain("Return time");
    expect(html).toContain("Definition / theorem");
    expect(html).toContain("mm-result-visual__body");
    expect(html).not.toContain("Interpretation boundary");
    expect(html).toContain("uncalibrated");
  });

  it("states allowed and forbidden inferences with source references", () => {
    const html = renderToStaticMarkup(
      <EvidencePanel
        claimIds={["measurement.local", "hypothesis.transcription"]}
        sourceIds={["snyder-2024"]}
      />,
    );

    expect(html).toContain("Allowed inference");
    expect(html).toContain("Do not infer");
    expect(html).toContain("Measured observation");
    expect(html).toContain("Transcription hypothesis");
    expect(html).toContain("snyder-2024");
    expect(html).toContain("w3c-webaudio");
    expect(html).not.toContain("marjieh-2024");
  });

  it("summarizes the current evidence boundary in the workbench rail", () => {
    const html = renderToStaticMarkup(
      <EvidenceRail claimIds={["model.deterministic"]} sourceIds={["snyder-2024"]} />,
    );

    expect(html).toContain("Current evidence boundary");
    expect(html).toContain("Computed result");
    expect(html).toContain("Allowed");
    expect(html).toContain("Do not infer");
    expect(html).toContain("Snyder 2024");
  });

  it("compares only the latest two runs and marks changed factors in text", () => {
    const first = trial("run-1", 80, 0.4);
    const second = trial("run-2", 90, 0.5);
    const third = trial("run-3", 120, 0.8);
    const html = renderToStaticMarkup(
      <ComparisonTable lesson={defaultLabLesson} trials={[first, second, third]} />,
    );

    expect(html).not.toContain("run-1");
    expect(html).toContain("Run A · run-2");
    expect(html).toContain("Run B · run-3");
    expect(html).toContain("Changed factors: Tempo");
    expect(html).toContain("Changed");
    expect(html).toContain("Held constant");
    expect(html).toContain("descriptive comparison, not a score or grade");
  });

  it("rejects an audio result whose provenance does not match the selected source", () => {
    const attempt = {
      version: 2,
      labId: defaultLabLesson.labId,
      lessonId: defaultLabLesson.id,
      stage: "experiment",
      trials: [],
      updatedAt: "2026-07-18T08:00:00.000Z",
    } as const;
    const fileEvaluation = {
      provenance: { source: "file" },
    } as LabEvaluation;

    expect(recordingBlocker(attempt, "microphone", fileEvaluation, defaultLabLesson)).toBe(
      "Analyze a fresh bounded segment from the selected source before recording a run.",
    );
  });
});

function trial(id: string, bpm: number, value: number): TrialSnapshotV2 {
  return {
    id,
    labId: defaultLabLesson.labId,
    lessonId: defaultLabLesson.id,
    protocolId: defaultLabLesson.protocol.id,
    deterministic: true,
    recordedAt: "2026-07-17T12:00:00.000Z",
    factors: { bpm, beatsPerBar: 4 },
    observables: [{
      id: "period",
      label: "Beat period",
      value,
      unit: "s",
      aggregation: "instantaneous",
      claimId: "math.identity",
      precision: 2,
    }],
    trace: [],
    provenance: {
      source: "model",
      calibration: "uncalibrated",
      method: "BPM conversion",
    },
  };
}
