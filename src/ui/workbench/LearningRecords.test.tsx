import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LessonDefinition } from "../../curriculum/contracts";
import type { LessonAttemptV2 } from "../../learning/portfolio/schema";
import { LearningRecords, PortfolioStatus } from "./LearningRecords";

const lessons: readonly LessonDefinition[] = [{
  id: "test-inquiry", domainId: "phase-proportion", number: 1, level: "foundation",
  title: "A musical inquiry", shortTitle: "Inquiry", question: "What changes?",
  objective: "Compare two conditions.", equation: "x = 1", equationCaption: "Test identity.",
  predictionPrompt: "Predict a change.", experimentPrompt: "Change one factor.",
  interpretationPrompt: "Explain the result.", transferPrompt: "Find another context.",
  factors: [], claimIds: [], sourceIds: [], inputModes: ["synthetic"],
  protocol: { id: "test-inquiry.v1", deterministic: true, durationSeconds: 8 },
}];
const selected = lessons[0];
const lessonHref = () => "#/test-lesson";
const onNavigate = () => undefined;

describe("notebook learning records", () => {
  it("does not label an untouched orientation as a completed or started inquiry", () => {
    const attempt: LessonAttemptV2 = { version: 2, labId: selected.domainId, lessonId: selected.id, stage: "orient", trials: [], updatedAt: "2026-09-09T12:00:00.000Z" };
    const markup = renderToStaticMarkup(<LearningRecords lessons={lessons} attempts={{ [`${selected.domainId}:${selected.id}`]: attempt }} lessonHref={lessonHref} onNavigate={onNavigate} />);
    expect(markup).toContain("No inquiries started yet");
    expect(markup).not.toContain('href="#/test-lesson"');
  });

  it("offers a resumable link with the actual inquiry stage and recorded run count", () => {
    const attempt: LessonAttemptV2 = { version: 2, labId: selected.domainId, lessonId: selected.id, stage: "predict", trials: [], updatedAt: "2026-09-09T12:00:00.000Z" };
    const markup = renderToStaticMarkup(<LearningRecords lessons={lessons} attempts={{ [`${selected.domainId}:${selected.id}`]: attempt }} lessonHref={lessonHref} onNavigate={onNavigate} />);
    expect(markup).toContain('href="#/test-lesson"');
    expect(markup).toContain("predict · 2 of 8");
    expect(markup).toContain("0 recorded runs");
  });

  it.each(["failed", "unavailable", "disabled"] as const)("never reports a saved portfolio when persistence is %s", (status) => {
    const markup = renderToStaticMarkup(<PortfolioStatus status={status} demoMode={false} />);
    expect(markup).not.toContain("Saved in this browser");
    expect(markup).toContain(status === "disabled" ? "Automatic saving off" : "Saving unavailable");
  });

  it("identifies demo records separately and only reports an actual successful save", () => {
    const markup = renderToStaticMarkup(<PortfolioStatus status="saved" demoMode />);
    expect(markup).toContain("Saved in this browser");
    expect(markup).toContain("Demo data · separate portfolio");
  });
});
