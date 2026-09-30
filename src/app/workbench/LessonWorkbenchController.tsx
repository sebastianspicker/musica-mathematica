import { Component, useMemo, type ReactElement } from "react";
import { defaultFactorsFor, type FactorValue, type LessonDefinition } from "../../curriculum/contracts";
import { evidenceClaimIdsFor } from "../../curriculum/evidence";
import type { CurriculumRegistry } from "../../curriculum/registry";
import type { LessonAttemptV2 } from "../../learning/portfolio/schema";
import { AudioInputController } from "../audio/AudioInputController";
import { briefStageFor } from "../../ui/workbench/LessonBrief";
import { LessonWorkbench } from "../../ui/workbench/LessonWorkbench";
import { LessonErrorFallback } from "../../ui/workbench/LessonErrorFallback";
import { PlaybackController } from "./PlaybackController";
import { useLessonController } from "./useLessonController";

export type LessonWorkbenchControllerProps = Readonly<{
  curriculum: CurriculumRegistry;
  lesson: LessonDefinition;
  attempt: LessonAttemptV2;
  initialFactors?: Readonly<Record<string, FactorValue>>;
  debriefActions?: ReactElement;
  onAttemptChange: (attempt: LessonAttemptV2) => void;
  onPersistenceMessage: (message: string | null) => void;
}>;

export function LessonWorkbenchController(props: LessonWorkbenchControllerProps): ReactElement {
  return <LessonErrorBoundary key={`${props.lesson.domainId}:${props.lesson.id}`} {...props} />;
}

class LessonErrorBoundary extends Component<LessonWorkbenchControllerProps, { failed: boolean; useDefaults: boolean }> {
  override state = { failed: false, useDefaults: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  private readonly retry = (): void => {
    this.setState({ failed: false, useDefaults: true });
  };

  override render(): ReactElement {
    if (this.state.failed) return <LessonErrorFallback lessonTitle={this.props.lesson.title} onRetry={this.retry} />;
    return <LessonSession {...this.props} initialFactors={this.state.useDefaults ? defaultFactorsFor(this.props.lesson) : this.props.initialFactors} />;
  }
}

function LessonSession(props: LessonWorkbenchControllerProps): ReactElement {
  const runtime = useLessonController(props);
  const claimIds = useMemo(() => evidenceClaimIdsFor(props.lesson.claimIds, runtime.evaluation.observables.map((observable) => observable.claimId)), [props.lesson, runtime.evaluation]);
  const domain = props.curriculum.domainById(props.lesson.domainId);
  const audioInput = runtime.experimentActive ? (
    <AudioInputController
      factors={runtime.factors}
      lesson={props.lesson}
      mode={runtime.inputMode}
      onAnalysis={runtime.setAudioEvaluation}
    />
  ) : null;
  return <LessonWorkbench
    {...props}
    audioInput={audioInput}
    briefStage={briefStageFor(props.attempt.stage)}
    claimIds={claimIds}
    domainNumber={domain?.number}
    domainTitle={domain?.title}
    runtime={{ ...runtime, audioAnalysisReady: Boolean(runtime.audioEvaluation) }}
    transport={<PlaybackController duration={props.lesson.protocol.durationSeconds} runtime={runtime} />}
  />;
}
