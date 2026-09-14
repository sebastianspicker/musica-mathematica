import { useId, type ReactElement } from "react";
import type { LessonDefinition } from "../../curriculum/contracts";

export const briefStages = ["predict", "experiment", "interpret", "transfer"] as const;
export type BriefStage = (typeof briefStages)[number];

export type LessonBriefProps = Readonly<{
  lesson: LessonDefinition;
  domainNumber: number | undefined;
  domainTitle?: string;
  stage?: BriefStage;
}>;

const stageLabels = new Map<BriefStage, string>([
  ["predict", "Predict"],
  ["experiment", "Experiment"],
  ["interpret", "Interpret"],
  ["transfer", "Transfer"],
]);

export function LessonBrief({ lesson, stage = "predict" }: LessonBriefProps): ReactElement {
  const headingId = useId();
  const prompt = promptForStage(lesson, stage);

  return (
    <section className="mm-lesson-brief" aria-labelledby={headingId}>
      <div className="mm-lesson-brief__identity">
        <h1 id={headingId}>{lesson.title}</h1>
        <p className="mm-lesson-brief__question">{lesson.question}</p>

      </div>
      <div className="mm-lesson-brief__task sr-only" aria-label={`Current task: ${stageLabels.get(stage)}`}>
        <span>Current task · {stageLabels.get(stage)}</span>
        <p>{prompt}</p>
      </div>

    </section>
  );
}

export function LessonEquation({ lesson }: Readonly<{ lesson: LessonDefinition }>): ReactElement {
  return (
      <aside className="mm-lesson-brief__equation" aria-label="Lesson equation">
        <span className="sr-only">Lesson identity</span>
        <code>{lesson.equation}</code>
        <p>{lesson.equationCaption}</p>
      </aside>
  );
}

function promptForStage(lesson: LessonDefinition, stage: BriefStage): string {
  switch (stage) {
    case "predict": return lesson.predictionPrompt;
    case "experiment": return lesson.experimentPrompt;
    case "interpret": return lesson.interpretationPrompt;
    case "transfer": return lesson.transferPrompt;
  }
}
