import { useId, type ReactElement } from "react";
import type { LessonDefinition } from "../../curriculum/contracts";

export const briefStages = ["predict", "experiment", "interpret", "transfer"] as const;
export type BriefStage = (typeof briefStages)[number];

export type LessonBriefProps = Readonly<{
  lesson: LessonDefinition;
  domainNumber: number | undefined;
  stage?: BriefStage;
}>;

const stageLabels = new Map<BriefStage, string>([
  ["predict", "Predict"],
  ["experiment", "Experiment"],
  ["interpret", "Interpret"],
  ["transfer", "Transfer"],
]);

export function LessonBrief({ domainNumber, lesson, stage = "predict" }: LessonBriefProps): ReactElement {
  const headingId = useId();
  const prompt = promptForStage(lesson, stage);

  return (
    <section className="mm-lesson-brief" aria-labelledby={headingId}>
      <div className="mm-lesson-brief__identity">
        <p className="mm-lesson-brief__crumb">
          Lab {domainNumber ?? "–"} · Lesson {lesson.number} · {lesson.level}
        </p>
        <h1 id={headingId}>{lesson.title}</h1>
        <p className="mm-lesson-brief__question">{lesson.question}</p>
      </div>
      <div className="mm-lesson-brief__task sr-only" aria-label={`Current task: ${stageLabels.get(stage)}`}>
        <span>Current task · {stageLabels.get(stage)}</span>
        <p>{prompt}</p>
      </div>
      <aside className="mm-lesson-brief__equation" aria-label="Lesson equation">
        <div className="mm-lesson-brief__equation-label">Identity</div>
        <code>{lesson.equation}</code>
        <p>{lesson.equationCaption}</p>
      </aside>
    </section>
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
