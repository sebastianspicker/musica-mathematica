import type { ReactElement } from "react";
import { audioAnalysisFactors, type FactorValue, type InputMode, type LessonDefinition } from "../../curriculum/contracts";
import type { LessonAttemptV2 } from "../../learning/portfolio/schema";
import { ComparisonTable } from "./ComparisonTable";
import { EvidencePanel } from "./EvidencePanel";
import { EvidenceRail } from "./EvidenceRail";
import { FactorInspector } from "./FactorInspector";
import { InquiryStage } from "./InquiryStage";
import { LessonBrief, LessonEquation } from "./LessonBrief";
import { NotebookReadings } from "./NotebookRun";
import { ResultVisual } from "./ResultVisual";
import type { BriefStage } from "./LessonBrief";
import type { LessonWorkbenchRuntimeView } from "./types";
import { lessonStages } from "../../learning/stages";

export type LessonWorkbenchProps = Readonly<{
  lesson: LessonDefinition;
  attempt: LessonAttemptV2;
  runtime: LessonWorkbenchRuntimeView;
  claimIds: readonly string[];
  briefStage: BriefStage;
  domainNumber: number | undefined;
  domainTitle: string | undefined;
  audioInput: ReactElement | null;
  transport: ReactElement;
  debriefActions?: ReactElement;
}>;

export function LessonWorkbench(props: LessonWorkbenchProps): ReactElement {
  const { runtime, attempt, lesson } = props;
  const revealed = attempt.stage !== "orient" && attempt.stage !== "predict";
  const laterStage = revealed && attempt.stage !== "experiment";
  const showPrediction = attempt.stage === "experiment" || attempt.stage === "compare" || attempt.stage === "explain";
  const comparison = <ComparisonTable lesson={lesson} trials={attempt.trials} />;
  const previewReady = runtime.inputMode === "synthetic" || runtime.audioAnalysisReady === true;
  const inspector = <InspectorStack experimentActive={runtime.experimentActive} factors={runtime.factors} inputMode={runtime.inputMode} lesson={lesson} onFactorChange={runtime.updateFactor} onInputModeChange={runtime.changeInputMode} compact={attempt.stage === "experiment"} />;
  const baseline = attempt.trials.at(-1);
  let stageContent: ReactElement | undefined;
  if (attempt.stage === "predict") stageContent = <><LessonEquation lesson={lesson} /><NotebookReadings lesson={lesson} factors={runtime.factors} /></>;
  if (attempt.stage === "experiment") stageContent = <div className="mm-notebook-experiment">
    {baseline ? <section className="mm-notebook-run mm-notebook-run--recorded" aria-label="Latest recorded run">
      <h3>{baseline.id.replace(/^run-/i, "Run ")} <span>Recorded</span></h3>
      <NotebookReadings lesson={lesson} factors={baseline.factors} factorMode="primary" observables={baseline.observables} /><NotebookReadings lesson={lesson} factors={baseline.factors} factorMode="context" />
      {baseline.note ? <p className="mm-notebook-run__note">{baseline.note}</p> : null}
    </section> : <p className="mm-notebook-empty">Record your first run, then change one factor for a controlled comparison.</p>}
    <form onSubmit={(event) => { event.preventDefault(); runtime.recordCurrentRun(); }}>
    <section className="mm-notebook-run mm-notebook-run--preview" aria-label="Current unrecorded preview">
      <h3>{runtime.recordLabel} <span>Preview · not recorded</span></h3>
      <div className="mm-notebook-preview">
        {inspector}
        {previewReady ? <NotebookReadings lesson={lesson} observables={runtime.evaluation.observables} /> : <p className="mm-notebook-pending" role="status">No audio analysis yet. Capture or select an audio segment to see its observations.</p>}
      </div>
      <NotebookReadings lesson={lesson} factors={runtime.factors} factorMode="context" />
    </section>
    <div className="mm-notebook-record-row"><details className="mm-notebook-notes"><summary>Add an optional observation note</summary><label><span>Optional observation note</span><textarea rows={2} value={runtime.note} onChange={(event) => { runtime.setNote(event.currentTarget.value); }} /></label></details>
    <div className="mm-notebook-record"><button className="mm-primary-action" type="submit">Record {runtime.recordLabel}</button></div></div>
    </form>
  </div>;
  if (attempt.stage === "compare" || attempt.stage === "explain") stageContent = comparison;

  return <section className={`mm-workbench mm-notebook${laterStage ? " mm-notebook--reflection" : ""}`} aria-label={`${lesson.title} workbench`}>
    <div className="mm-workbench__content">
      <div id="mm-current-task" tabIndex={-1}><LessonBrief domainNumber={props.domainNumber} domainTitle={props.domainTitle} lesson={lesson} stage={props.briefStage} /></div>
      {showPrediction && attempt.prediction ? <div className="mm-notebook-prediction"><strong>My prediction (committed):</strong><p>{attempt.prediction}</p></div> : null}
      <section className={`mm-inquiry mm-inquiry--${attempt.stage}`} aria-label="Current inquiry stage">
        <InquiryStage attempt={attempt} comparisonReason={runtime.comparison.reason} lesson={lesson} note={runtime.note} onBeginPrediction={runtime.beginPrediction} onCompare={runtime.openComparison} onNoteChange={runtime.setNote} onSavePrediction={runtime.savePrediction} onSaveResponse={runtime.saveResponse} stageContent={stageContent} />
        {attempt.stage === "compare" ? <button className="mm-primary-action" type="button" onClick={runtime.openInterpretation}>Interpret the evidence</button> : null}
        {runtime.message ? <p className={runtime.message.routine ? "sr-only" : "mm-inquiry-message"} role="status">{runtime.message.text}</p> : null}
        {attempt.stage === "debrief" ? <>{comparison}{props.debriefActions}</> : null}
      </section>
      {revealed ? <>
        <InterpretationBoundary annotation={runtime.evaluation.annotation} />
        <details className="mm-notebook-detail" open={runtime.inputMode !== "synthetic"}><summary>Explore the model, charts and playback</summary><div className="mm-analysis-stage">{attempt.stage !== "experiment" ? inspector : null}{props.audioInput}<LessonEquation lesson={lesson} />{previewReady ? <ResultVisual evaluation={runtime.evaluation} /> : <p role="status">No audio analysis yet.</p>}{props.transport}</div></details>
        {attempt.stage === "perform" || attempt.stage === "transfer" ? <details className="mm-notebook-detail"><summary>Review recorded evidence</summary>{comparison}</details> : null}
      </> : null}
      <details className="mm-notebook-detail mm-evidence-detail"><summary>View detailed claim boundaries and sources</summary><EvidencePanel claimIds={props.claimIds} sourceIds={lesson.sourceIds} /><EvidenceRail claimIds={props.claimIds} sourceIds={lesson.sourceIds} /></details>
      <footer className="mm-lesson-footer"><span>Lab {props.domainNumber === undefined ? "–" : String(props.domainNumber).padStart(2, "0")} · {props.domainTitle ?? lesson.domainId} · Lesson {lesson.number} · {lesson.level}<br />Stage {lessonStages.indexOf(attempt.stage) + 1} of {lessonStages.length}</span><button type="button" onClick={runtime.restartLesson}>Restart lesson</button></footer>
    </div>
  </section>;
}

type InspectorStackProps = Readonly<{
  experimentActive: boolean;
  factors: Record<string, FactorValue>;
  inputMode: InputMode;
  lesson: LessonDefinition;
  onFactorChange: (factorId: string, value: FactorValue) => void;
  onInputModeChange: (mode: InputMode) => void;
  compact?: boolean;
}>;

function InspectorStack(props: InspectorStackProps): ReactElement {
  return <div className="mm-inspector-stack">
    <FactorInspector compact={props.compact} disabled={!props.experimentActive} inputMode={props.inputMode} lesson={props.lesson} onFactorChange={props.onFactorChange} onInputModeChange={props.onInputModeChange} values={props.factors} />
    {props.experimentActive && props.inputMode !== "synthetic" && audioAnalysisFactors(props.lesson).length === 0 ? <p className="mm-audio-message">Audio is an observation appendix here. Controlled portfolio comparisons use the synthetic factors because this lesson does not expose an audio-analysis factor.</p> : null}
  </div>;
}

function InterpretationBoundary({ annotation }: Readonly<{ annotation: string }>): ReactElement {
  return (
    <aside className="mm-interpretation-boundary" aria-labelledby="mm-interpretation-boundary-heading">
      <div>
        <h2 id="mm-interpretation-boundary-heading">Interpretation boundary</h2>
        <p>{annotation}</p>
      </div>
    </aside>
  );
}
