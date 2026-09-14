import type { FormEvent, ReactElement } from "react";
import { lessonStages } from "../../learning/stages";
import type { LessonAttemptV2 } from "../../learning/portfolio/schema-v2";
import type { LessonDefinition } from "../../curriculum/contracts";

type InquiryStageProps = Readonly<{
  attempt: LessonAttemptV2;
  lesson: LessonDefinition;
  comparisonReason: string;
  note: string;
  stageContent?: ReactElement;
  onBeginPrediction: () => void;
  onSavePrediction: (event: FormEvent<HTMLFormElement>) => void;
  onCompare: () => void;
  onNoteChange: (value: string) => void;
  onSaveResponse: (
    event: FormEvent<HTMLFormElement>,
    field: "explanation" | "performanceReflection" | "transferResponse",
    nextStage: "perform" | "transfer" | "debrief",
  ) => void;
}>;

export function InquiryStage(props: InquiryStageProps): ReactElement {
  const { attempt, lesson } = props;
  if (attempt.stage === "orient") return <OrientStage lesson={lesson} onBeginPrediction={props.onBeginPrediction} />;
  if (attempt.stage === "predict") return <PredictionStage stageContent={props.stageContent} lesson={lesson} onSavePrediction={props.onSavePrediction} />;
  if (attempt.stage === "experiment") return <ExperimentStage {...props} />;
  if (attempt.stage === "compare") return <CompareStage reason={props.comparisonReason} stageContent={props.stageContent} />;
  if (attempt.stage === "explain") return <ResponseStage stageContent={props.stageContent} key={attempt.stage} field="explanation" heading="What changed, and why?" prompt={lesson.interpretationPrompt} button="Save explanation & continue" onSubmit={(event) => {
    props.onSaveResponse(event, "explanation", "perform");
  }} />;
  if (attempt.stage === "perform") return <ResponseStage stageContent={props.stageContent} key={attempt.stage} field="performanceReflection" heading="Take the question to your instrument" prompt={`Try this away from the display: ${lesson.transferPrompt} What did hearing or performing add that the model did not?`} button="Save reflection & continue" onSubmit={(event) => {
    props.onSaveResponse(event, "performanceReflection", "transfer");
  }} />;
  if (attempt.stage === "transfer") return <ResponseStage stageContent={props.stageContent} key={attempt.stage} field="transferResponse" heading="Where would you use this reasoning?" prompt={lesson.transferPrompt} button="Save response & finish" onSubmit={(event) => {
    props.onSaveResponse(event, "transferResponse", "debrief");
  }} />;
  return <DebriefStage attempt={attempt} />;
}

function OrientStage({ lesson, onBeginPrediction }: Readonly<{ lesson: LessonDefinition; onBeginPrediction: () => void }>): ReactElement {
  return <div className="mm-stage-card"><h2 tabIndex={-1}>Start with a prediction</h2><p>{lesson.objective}</p><button className="mm-primary-action" type="button" onClick={onBeginPrediction}>Start with a prediction</button></div>;
}

function PredictionStage({ lesson, onSavePrediction, stageContent }: Readonly<{ stageContent?: ReactElement; lesson: LessonDefinition; onSavePrediction: (event: FormEvent<HTMLFormElement>) => void }>): ReactElement {
  return <form className="mm-stage-card" onSubmit={onSavePrediction}><h2 tabIndex={-1}>Predict</h2>{stageContent}<label><span>{lesson.predictionPrompt}</span><textarea required minLength={8} name="prediction" rows={3} /></label><button className="mm-primary-action" type="submit">Commit prediction & begin</button></form>;
}

function ExperimentStage(props: InquiryStageProps): ReactElement {
  return <div className="mm-stage-card"><h2 tabIndex={-1}>Experiment</h2><p>{props.lesson.experimentPrompt}</p>{props.stageContent}<div className="mm-inline-actions"><button disabled={props.attempt.trials.length < 2} type="button" onClick={props.onCompare}>Compare the latest two runs</button></div><p className="mm-comparison-readiness">{props.comparisonReason}</p></div>;
}

function CompareStage({ reason, stageContent }: Readonly<{ reason: string; stageContent?: ReactElement }>): ReactElement {
  return <div className="mm-stage-card"><h2 tabIndex={-1}>Compare your recorded runs</h2><p>{reason}</p>{stageContent}</div>;
}

type ResponseStageProps = Readonly<{
  stageContent?: ReactElement;
  field: "explanation" | "performanceReflection" | "transferResponse";
  heading: string;
  prompt: string;
  button: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}>;

function ResponseStage({ field, heading, prompt, button, onSubmit, stageContent }: ResponseStageProps): ReactElement {
  return <form className="mm-stage-card" onSubmit={onSubmit}><h2 tabIndex={-1}>{heading}</h2><p>{prompt}</p>{field === "performanceReflection" ? <p>No recording is required.</p> : null}{stageContent}<label><span>{field === "explanation" ? "My explanation" : field === "performanceReflection" ? "My performance reflection" : "My transfer response"}</span><textarea required minLength={8} name={field} rows={4} /></label><button className="mm-primary-action" type="submit">{button}</button></form>;
}

function DebriefStage({ attempt }: Readonly<{ attempt: LessonAttemptV2 }>): ReactElement {
  return <div className="mm-stage-card mm-stage-card--complete"><h2 tabIndex={-1}>Your inquiry is recorded</h2><p>Review your evidence and reflections. Completion is not a grade or a measure of learning effectiveness.</p><dl><div><dt>Prediction</dt><dd>{attempt.prediction}</dd></div><div><dt>Interpretation</dt><dd>{attempt.explanation}</dd></div><div><dt>Performance reflection</dt><dd>{attempt.performanceReflection}</dd></div><div><dt>Transfer</dt><dd>{attempt.transferResponse}</dd></div></dl></div>;
}

export function StageProgress({ stage }: Readonly<{ stage: LessonAttemptV2["stage"] }>): ReactElement {
  const current = lessonStages.indexOf(stage);
  return (
    <nav className="mm-stage-ribbon" aria-label="Inquiry progress">
      <p className="mm-stage-ribbon__current" aria-hidden="true">{current + 1} of {lessonStages.length} · {stageLabel(stage)}</p>
      <ol className="mm-stage-ribbon__stages">
      {lessonStages.map((item, index) => {
        const state = index < current ? "complete" : index === current ? "current" : "upcoming";
        return (
          <li
            key={item}
            className={`mm-stage-ribbon__seg mm-stage-ribbon__seg--${state}`}
            aria-current={index === current ? "step" : undefined}
          >
            <span className="mm-stage-ribbon__number">{index + 1}</span>
            <span className="mm-stage-ribbon__label">{stageLabel(item)}</span>
          </li>
        );
      })}
      </ol>
    </nav>
  );
}

function stageLabel(stage: (typeof lessonStages)[number]): string {
  return `${stage[0].toUpperCase()}${stage.slice(1)}`;
}
