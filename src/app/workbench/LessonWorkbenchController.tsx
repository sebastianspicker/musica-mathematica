import type { ReactElement } from "react";
import type { LessonDefinition } from "../../curriculum/contracts";
import type { CurriculumRegistry } from "../../curriculum/registry";
import type { LessonAttemptV2 } from "../../learning/portfolio/schema-v2";
import { AudioInputController } from "../audio/AudioInputController";
import { LessonWorkbench } from "../../ui/workbench/LessonWorkbench";
import { useLessonController } from "./useLessonController";
import { briefStageFor, evidenceClaimIdsFor } from "./workbenchHelpers";

export type LessonWorkbenchControllerProps = Readonly<{
  curriculum: CurriculumRegistry;
  lesson: LessonDefinition;
  attempt: LessonAttemptV2;
  onAttemptChange: (attempt: LessonAttemptV2) => void;
  onPersistenceMessage: (message: string | null) => void;
}>;

export function LessonWorkbenchController(props: LessonWorkbenchControllerProps): ReactElement {
  const runtime = useLessonController(props);
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
    claimIds={evidenceClaimIdsFor(props.lesson, runtime.evaluation)}
    domainNumber={props.curriculum.domainById(props.lesson.domainId)?.number}
    runtime={runtime}
  />;
}
