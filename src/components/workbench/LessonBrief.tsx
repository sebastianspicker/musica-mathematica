import { useId, type ReactElement } from "react";
import { domainById } from "../../labs/catalog";
import type { LabLesson } from "../../labs/types";

export const lessonStages = ["predict", "experiment", "interpret", "transfer"] as const;
export type LessonStage = (typeof lessonStages)[number];

export type LessonBriefProps = Readonly<{
  lesson: LabLesson;
  stage?: LessonStage;
}>;

const stageLabels: Readonly<Record<LessonStage, string>> = {
  predict: "Predict",
  experiment: "Experiment",
  interpret: "Interpret",
  transfer: "Transfer",
};

export function LessonBrief({ lesson, stage = "predict" }: LessonBriefProps): ReactElement {
  const headingId = useId();
  const domain = domainById(lesson.labId);
  const prompt = promptForStage(lesson, stage);

  return (
    <section className="mm-lesson-brief" aria-labelledby={headingId}>
      <div className="mm-lesson-brief__identity">
        <p className="mm-lesson-brief__crumb">
          Lab {domain?.number ?? "–"} · Lesson {lesson.number} · {lesson.level}
        </p>
        <h1 id={headingId}>{lesson.title}</h1>
        <p className="mm-lesson-brief__question">{lesson.question}</p>
      </div>
      <div className="mm-lesson-brief__task sr-only" aria-label={`Current task: ${stageLabels[stage]}`}>
        <span>Current task · {stageLabels[stage]}</span>
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

function promptForStage(lesson: LabLesson, stage: LessonStage): string {
  switch (stage) {
    case "predict": return lesson.predictionPrompt;
    case "experiment": return lesson.experimentPrompt;
    case "interpret": return lesson.interpretationPrompt;
    case "transfer": return lesson.transferPrompt;
  }
}
