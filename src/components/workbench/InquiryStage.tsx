import type { FormEvent, ReactElement } from "react";
import { lessonStages } from "../../learning/lessonAttempt";
import type { LessonAttemptV2 } from "../../learning/portfolio";
import type { LabLesson } from "../../labs/types";

type InquiryStageProps = Readonly<{
  attempt: LessonAttemptV2;
  lesson: LabLesson;
  comparisonReason: string;
  note: string;
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
  if (attempt.stage === "predict") return <PredictionStage lesson={lesson} onSavePrediction={props.onSavePrediction} />;
  if (attempt.stage === "experiment") return <ExperimentStage {...props} />;
  if (attempt.stage === "compare") return <CompareStage reason={props.comparisonReason} />;
  if (attempt.stage === "explain") return <ResponseStage field="explanation" heading="Interpret" prompt={lesson.interpretationPrompt} button="Save interpretation and try the musical task" onSubmit={(event) => props.onSaveResponse(event, "explanation", "perform")} />;
  if (attempt.stage === "perform") return <ResponseStage field="performanceReflection" heading="Perform / hear" prompt={`Try this away from the display: ${lesson.transferPrompt} What did hearing or performing add that the model did not?`} button="Save reflection and transfer" onSubmit={(event) => props.onSaveResponse(event, "performanceReflection", "transfer")} />;
  if (attempt.stage === "transfer") return <ResponseStage field="transferResponse" heading="Transfer" prompt={lesson.transferPrompt} button="Save transfer and open debrief" onSubmit={(event) => props.onSaveResponse(event, "transferResponse", "debrief")} />;
  return <DebriefStage attempt={attempt} />;
}

function OrientStage({ lesson, onBeginPrediction }: Readonly<{ lesson: LabLesson; onBeginPrediction: () => void }>): ReactElement {
  return <div className="mm-stage-card"><h3>Orient</h3><p>{lesson.objective}</p><button className="mm-primary-action" type="button" onClick={onBeginPrediction}>Start with a prediction</button></div>;
}

function PredictionStage({ lesson, onSavePrediction }: Readonly<{ lesson: LabLesson; onSavePrediction: (event: FormEvent<HTMLFormElement>) => void }>): ReactElement {
  return <form className="mm-stage-card" onSubmit={onSavePrediction}><h3>Predict before manipulating</h3><label><span>{lesson.predictionPrompt}</span><textarea required minLength={8} name="prediction" rows={3} /></label><button className="mm-primary-action" type="submit">Save prediction and begin experiment</button></form>;
}

function ExperimentStage(props: InquiryStageProps): ReactElement {
  return <div className="mm-stage-card"><h3>Experiment</h3><p>{props.lesson.experimentPrompt}</p><label><span>Optional observation note</span><textarea rows={2} value={props.note} onChange={(event) => props.onNoteChange(event.currentTarget.value)} /></label><div className="mm-inline-actions"><button disabled={props.attempt.trials.length < 2} type="button" onClick={props.onCompare}>Compare the latest two runs</button></div><p className="mm-comparison-readiness">{props.comparisonReason}</p></div>;
}

function CompareStage({ reason }: Readonly<{ reason: string }>): ReactElement {
  return <div className="mm-stage-card"><h3>Compare</h3><p>{reason}</p></div>;
}

type ResponseStageProps = Readonly<{
  field: "explanation" | "performanceReflection" | "transferResponse";
  heading: string;
  prompt: string;
  button: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}>;

function ResponseStage({ field, heading, prompt, button, onSubmit }: ResponseStageProps): ReactElement {
  return <form className="mm-stage-card" onSubmit={onSubmit}><h3>{heading}</h3><label><span>{prompt}</span><textarea required minLength={8} name={field} rows={4} /></label><button className="mm-primary-action" type="submit">{button}</button></form>;
}

function DebriefStage({ attempt }: Readonly<{ attempt: LessonAttemptV2 }>): ReactElement {
  return <div className="mm-stage-card mm-stage-card--complete"><h3>Debrief complete</h3><p>This lesson records a prediction, controlled comparison, interpretation, musical reflection, and transfer response. Completion is not a grade or evidence of learning effectiveness.</p><dl><div><dt>Prediction</dt><dd>{attempt.prediction}</dd></div><div><dt>Interpretation</dt><dd>{attempt.explanation}</dd></div><div><dt>Performance reflection</dt><dd>{attempt.performanceReflection}</dd></div><div><dt>Transfer</dt><dd>{attempt.transferResponse}</dd></div></dl></div>;
}

export function StageProgress({ stage }: Readonly<{ stage: LessonAttemptV2["stage"] }>): ReactElement {
  const current = lessonStages.indexOf(stage);
  return (
    <div className="mm-stage-progress mm-stage-ribbon" aria-label="Inquiry progress">
      {lessonStages.map((item, index) => {
        const state = index < current ? "complete" : index === current ? "current" : "upcoming";
        return (
          <span
            key={item}
            className={`mm-stage-ribbon__seg mm-stage-ribbon__seg--${state}`}
            aria-current={index === current ? "step" : undefined}
          >
            <span className="sr-only">{item}{index === current ? " (current)" : ""}</span>
          </span>
        );
      })}
    </div>
  );
}
