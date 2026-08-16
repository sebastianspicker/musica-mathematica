import type { ReactElement } from "react";
import { type FactorValue, type InputMode, type LabLesson } from "../../labs/types";
import type { LessonAttemptV2 } from "../../learning/portfolio";
import { AudioInputPanel } from "./AudioInputPanel";
import { ComparisonTable } from "./ComparisonTable";
import { EvidencePanel } from "./EvidencePanel";
import { EvidenceRail } from "./EvidenceRail";
import { FactorInspector } from "./FactorInspector";
import { InquiryStage, StageProgress } from "./InquiryStage";
import { LessonBrief } from "./LessonBrief";
import { ResultVisual } from "./ResultVisual";
import { useLessonWorkbench } from "./useLessonWorkbench";
import { briefStageFor, evidenceClaimIdsFor, runLabel } from "./workbenchHelpers";
import { InterfaceIcon } from "../InterfaceIcon";

export type LessonWorkbenchProps = Readonly<{
  lesson: LabLesson;
  attempt: LessonAttemptV2;
  onAttemptChange: (attempt: LessonAttemptV2) => void;
  onPersistenceMessage: (message: string | null) => void;
}>;

export function LessonWorkbench(props: LessonWorkbenchProps): ReactElement {
  const runtime = useLessonWorkbench(props);
  const claimIds = evidenceClaimIdsFor(props.lesson, runtime.evaluation);

  return <section className="mm-workbench" aria-label={`${props.lesson.title} workbench`}>
    <div className="mm-workbench__content">
      <div id="mm-current-task" tabIndex={-1}>
        <LessonBrief lesson={props.lesson} stage={briefStageFor(props.attempt.stage)} />
      </div>
      <div className="mm-workbench-grid">
        <ExperimentStage lesson={props.lesson} runtime={runtime} />
        <aside className="mm-workflow-panel" aria-label="Lesson workflow and factors">
          <section className={`mm-inquiry mm-inquiry--${props.attempt.stage}`} aria-labelledby="mm-inquiry-heading">
            <header className="mm-inquiry-header">
              <div>
                <p className="mm-inquiry-header__eyebrow">Lesson workflow</p>
                <h2 id="mm-inquiry-heading" className="mm-inquiry-header__title">Your next step</h2>
              </div>
              <button type="button" onClick={runtime.restartLesson}>Restart</button>
            </header>
            <StageProgress stage={props.attempt.stage} />
            {runtime.message ? <p className="mm-inquiry-message" role="status">{runtime.message}</p> : null}
            <InquiryStage
              attempt={props.attempt}
              comparisonReason={runtime.comparison.reason}
              lesson={props.lesson}
              note={runtime.note}
              onBeginPrediction={runtime.beginPrediction}
              onCompare={runtime.openComparison}
              onNoteChange={runtime.setNote}
              onSavePrediction={runtime.savePrediction}
              onSaveResponse={runtime.saveResponse}
            />
          </section>
          <InspectorStack
            experimentActive={runtime.experimentActive}
            factors={runtime.factors}
            inputMode={runtime.inputMode}
            lesson={props.lesson}
            onAnalysis={runtime.setAudioEvaluation}
            onFactorChange={runtime.updateFactor}
            onInputModeChange={runtime.changeInputMode}
            onInterpret={runtime.openInterpretation}
            onRecord={runtime.recordCurrentRun}
            stage={props.attempt.stage}
            trialCount={props.attempt.trials.length}
          />
        </aside>
      </div>
      <div className="mm-workbench-band" aria-label="Comparison and interpretation">
        <ComparisonTable lesson={props.lesson} trials={props.attempt.trials} />
        <InterpretationBoundary annotation={runtime.evaluation.annotation} />
      </div>
      <details className="mm-evidence-detail">
        <summary>View detailed claim boundaries and sources</summary>
        <EvidencePanel claimIds={claimIds} sourceIds={props.lesson.sourceIds} />
      </details>
    </div>
    <EvidenceRail claimIds={claimIds} sourceIds={props.lesson.sourceIds} />
  </section>;
}

type ExperimentStageProps = Readonly<{
  lesson: LabLesson;
  runtime: ReturnType<typeof useLessonWorkbench>;
}>;

function ExperimentStage({ lesson, runtime }: ExperimentStageProps): ReactElement {
  const { audio, evaluation } = runtime;
  return <section className="mm-analysis-stage" aria-label="Interactive mathematical result">
    <ResultVisual evaluation={evaluation} />
    <div className="mm-transport" aria-label="Experiment transport">
      <button disabled={!runtime.experimentActive || !runtime.motionEnabled} type="button" onClick={runtime.togglePlayback}>
        <InterfaceIcon name={runtime.running ? "pause" : "play"} />
        <span>{runtime.running ? "Pause" : "Play"}</span>
      </button>
      <button disabled={!runtime.experimentActive || runtime.running} type="button" onClick={runtime.stepPlayback}>
        <InterfaceIcon name="step" />
        <span>Step 0.5 s</span>
      </button>
      <button type="button" onClick={runtime.resetPlayback}>
        <InterfaceIcon name="reset" />
        <span>Reset view</span>
      </button>
      <div className="mm-transport-time"><span>Protocol</span><strong>{runtime.playhead.toFixed(1)} / {lesson.protocol.durationSeconds.toFixed(1)} s</strong></div>
      <label className="mm-compact-toggle"><input checked={runtime.motionEnabled} type="checkbox" onChange={(event) => { runtime.setMotionEnabled(event.currentTarget.checked); if (!event.currentTarget.checked) runtime.resetPlayback(); }} />Motion</label>
      <label className="mm-compact-toggle"><input checked={audio.audioEnabled} type="checkbox" onChange={(event) => {
        audio.setAudioEnabled(event.currentTarget.checked);
      }} />Audio</label>
      <label className="mm-volume-control"><span>Volume</span><input aria-label="Preview volume" disabled={!audio.audioEnabled} min="0" max="100" type="range" value={Math.round(audio.audioVolume * 100)} onChange={(event) => {
        audio.setAudioVolume(event.currentTarget.valueAsNumber / 100);
      }} /></label>
    </div>
    {audio.audioUnavailableReason ? <p className="mm-audio-message" role="status">{audio.audioUnavailableReason}</p> : null}
  </section>;
}

type InspectorStackProps = Readonly<{
  experimentActive: boolean;
  factors: Record<string, FactorValue>;
  inputMode: InputMode;
  lesson: LabLesson;
  onAnalysis: ReturnType<typeof useLessonWorkbench>["setAudioEvaluation"];
  onFactorChange: (factorId: string, value: FactorValue) => void;
  onInputModeChange: (mode: InputMode) => void;
  onInterpret: () => void;
  onRecord: () => void;
  stage: LessonAttemptV2["stage"];
  trialCount: number;
}>;

function InspectorStack(props: InspectorStackProps): ReactElement {
  return <div className="mm-inspector-stack">
    <FactorInspector disabled={!props.experimentActive} inputMode={props.inputMode} lesson={props.lesson} onFactorChange={props.onFactorChange} onInputModeChange={props.onInputModeChange} values={props.factors} />
    {props.stage === "experiment" ? <div className="mm-inspector-action"><button className="mm-primary-action" type="button" onClick={props.onRecord}>Record {runLabel(props.trialCount)}</button></div> : null}
    {props.stage === "compare" ? <div className="mm-inspector-action"><button className="mm-primary-action" type="button" onClick={props.onInterpret}>Interpret the evidence</button></div> : null}
    {props.experimentActive ? <AudioInputPanel factors={props.factors} lesson={props.lesson} mode={props.inputMode} onAnalysis={props.onAnalysis} /> : null}
    {props.experimentActive && props.inputMode !== "synthetic" && props.lesson.id !== "recorded-onset-hypotheses" ? <p className="mm-audio-message">Audio is an observation appendix here. Controlled portfolio comparisons use the synthetic factors because this lesson does not expose an audio-analysis factor.</p> : null}
  </div>;
}

function InterpretationBoundary({ annotation }: Readonly<{ annotation: string }>): ReactElement {
  return (
    <aside className="mm-interpretation-boundary" aria-labelledby="mm-interpretation-boundary-heading">
      <div className="mm-interpretation-boundary__mark" aria-hidden="true">∂</div>
      <div>
        <h2 id="mm-interpretation-boundary-heading">Interpretation boundary</h2>
        <p>{annotation}</p>
      </div>
    </aside>
  );
}
