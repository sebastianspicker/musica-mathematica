import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { curriculumCatalog, defaultLesson, evaluatorFor } from "../curriculum/catalog";
import type { LessonAttemptV2 } from "../learning/portfolio/schema-v2";
import { LessonWorkbench, type LessonWorkbenchProps } from "../ui/workbench/LessonWorkbench";

function props(stage: LessonAttemptV2["stage"]): LessonWorkbenchProps {
  const lesson = defaultLesson;
  const factors = Object.fromEntries(lesson.factors.map((factor) => [factor.id, factor.defaultValue]));
  return {
    lesson, attempt: { version: 2, labId: lesson.domainId, lessonId: lesson.id, stage, trials: [], updatedAt: "2026-09-09" },
    briefStage: "predict", domainNumber: 1, domainTitle: "Phase and proportion", claimIds: [], audioInput: null, transport: <div>Playback test surface</div>,
    runtime: {
      factors, evaluation: evaluatorFor(lesson.domainId, lesson.id)(factors), experimentActive: stage === "experiment", inputMode: "synthetic", message: null, motionEnabled: false, note: "", recordLabel: "Run A", comparison: { reason: "Record two runs before comparing them." },
      audio: { audioEnabled: false, audioVolume: 0.3, audioUnavailableReason: null, setAudioEnabled: vi.fn(), setAudioVolume: vi.fn() },
      beginPrediction: vi.fn(), changeInputMode: vi.fn(), openComparison: vi.fn(), openInterpretation: vi.fn(), recordCurrentRun: vi.fn(), resetPlayback: vi.fn(), restartLesson: vi.fn(), savePrediction: vi.fn(), saveResponse: vi.fn(), setMotionEnabled: vi.fn(), setNote: vi.fn(), stepPlayback: vi.fn(), togglePlayback: vi.fn(), updateFactor: vi.fn(),
    },
  };
}

describe("guided notebook", () => {
  it.each(["orient", "predict"] as const)("does not expose computed results or playback during %s", (stage) => {
    const markup = renderToStaticMarkup(<LessonWorkbench {...props(stage)} />);
    expect(markup).not.toContain("Playback test surface");
    expect(markup).not.toContain("Current unrecorded preview");
    expect(markup).not.toContain("mm-result");
  });

  it("separates recorded values from the unrecorded preview and preserves trial notes", () => {
    const input = props("experiment");
    const trial = { id: "Run A", labId: input.lesson.domainId, lessonId: input.lesson.id, protocolId: input.lesson.protocol.id, deterministic: true, recordedAt: "2026-09-09", factors: input.runtime.factors, observables: input.runtime.evaluation.observables, trace: [], provenance: input.runtime.evaluation.provenance, note: "My recorded observation" };
    const markup = renderToStaticMarkup(<LessonWorkbench {...input} attempt={{ ...input.attempt, prediction: "My committed expectation", trials: [trial] }} runtime={{ ...input.runtime, recordLabel: "Run B" }} />);
    expect(markup).toContain("My committed expectation");
    expect(markup).toContain("My recorded observation");
    expect(markup.indexOf("Latest recorded run")).toBeLessThan(markup.indexOf("Current unrecorded preview"));
    expect(markup).toContain("Record Run B");
    expect(markup).toContain("Preview · not recorded");
  });

  it("renders real reflections and supplied debrief actions", () => {
    const input = props("debrief");
    const markup = renderToStaticMarkup(<LessonWorkbench {...input} attempt={{ ...input.attempt, prediction: "Prediction verbatim", explanation: "Explanation verbatim", performanceReflection: "Performance verbatim", transferResponse: "Transfer verbatim" }} debriefActions={<button>Export portfolio JSON</button>} />);
    for (const text of ["Prediction verbatim", "Explanation verbatim", "Performance verbatim", "Transfer verbatim", "Export portfolio JSON"]) expect(markup).toContain(text);
  });

  it("renders every curriculum lesson with its own factors", () => {
    const base = props("experiment");
    for (const domain of curriculumCatalog) for (const lesson of domain.lessons) {
      const factors = Object.fromEntries(lesson.factors.map((factor) => [factor.id, factor.defaultValue]));
      const markup = renderToStaticMarkup(<LessonWorkbench {...base} lesson={lesson} runtime={{ ...base.runtime, factors, evaluation: evaluatorFor(lesson.domainId, lesson.id)(factors) }} />);
      expect(markup).toContain(lesson.title.replaceAll("&", "&amp;"));
      expect((markup.match(/class="mm-factor-control/g) ?? []).length).toBeGreaterThanOrEqual(lesson.factors.length);
    }
  });
});

it.each(["compare", "explain", "perform", "transfer", "debrief"] as const)("keeps model controls and audio input available in %s", (stage) => {
  const input = props(stage);
  const markup = renderToStaticMarkup(<LessonWorkbench {...input} runtime={{ ...input.runtime, experimentActive: true }} audioInput={<div>Audio input tools</div>} />);
  expect(markup).toContain("Audio input tools");
  expect(markup).toContain("Experimental factors");
  expect(markup).not.toContain('type="submit">Record');
});

it("shows pending audio honestly instead of exposing fallback model outputs", () => {
  const input = props("experiment");
  const markup = renderToStaticMarkup(<LessonWorkbench {...input} runtime={{ ...input.runtime, inputMode: "file", audioAnalysisReady: false }} />);
  expect(markup).toContain("No audio analysis yet");
  expect(markup).not.toContain("mm-result");
});

it("announces routine saves quietly while retaining visible actionable failures", () => {
  const input = props("experiment");
  const routine = renderToStaticMarkup(<LessonWorkbench {...input} runtime={{ ...input.runtime, message: "Run A recorded locally. Change one factor before Run B." }} />);
  expect(routine).toContain('class="sr-only" role="status">Run A recorded locally.');
  const failure = renderToStaticMarkup(<LessonWorkbench {...input} runtime={{ ...input.runtime, message: "The run could not be recorded. Check the inquiry stage and result provenance." }} />);
  expect(failure).toContain('class="mm-inquiry-message" role="status">The run could not be recorded.');
});

it.each(["perform", "transfer", "debrief"] as const)("prioritizes the %s response without repeating the prediction strip", (stage) => {
  const input = props(stage);
  const markup = renderToStaticMarkup(<LessonWorkbench {...input} attempt={{ ...input.attempt, prediction: "A stored prediction" }} />);
  expect(markup).toContain("mm-notebook--reflection");
  expect(markup).not.toContain('class="mm-notebook-prediction"');
  if (stage === "debrief") expect(markup).toContain("A stored prediction");
});
