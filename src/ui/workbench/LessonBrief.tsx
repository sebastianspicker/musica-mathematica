import { useId, type ReactElement } from "react";
import type { LessonDefinition } from "../../curriculum/contracts";
import type { LessonStage } from "../../learning/stages";
import { Equation } from "../Equation";

export const briefStages = ["predict", "experiment", "interpret", "transfer"] as const;
export type BriefStage = (typeof briefStages)[number];

export function briefStageFor(stage: LessonStage): BriefStage {
  if (stage === "orient" || stage === "predict") return "predict";
  if (stage === "experiment") return "experiment";
  if (stage === "compare" || stage === "explain" || stage === "perform") return "interpret";
  return "transfer";
}

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

const movementNumerals = ["I", "II", "III"] as const;

export function LessonBrief({ lesson, domainNumber, domainTitle, stage = "predict" }: LessonBriefProps): ReactElement {
  const headingId = useId();
  const prompt = promptForStage(lesson, stage);

  return (
    <section className="mm-lesson-brief" aria-labelledby={headingId}>
      <div className="mm-lesson-brief__identity">
        <p className="mm-cue mm-lesson-brief__place">
          <span className="mm-lesson-brief__domain">{domainNumber === undefined ? null : <span className="mm-figure">{String(domainNumber).padStart(2, "0")}</span>} {domainTitle ?? lesson.domainId}</span>
          <span className="mm-lesson-brief__level"><span className="mm-figure" aria-hidden="true">{movementNumerals[lesson.number - 1] ?? lesson.number}</span><span className="sr-only">Lesson {lesson.number},</span> {lesson.level}</span>
        </p>
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
      <p className="mm-cue" aria-hidden="true">Model</p>
      <p className="mm-lesson-brief__formula"><Equation source={lesson.equation} /></p>
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
