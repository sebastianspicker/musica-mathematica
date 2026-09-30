import type { ReactElement } from "react";
import type { LessonDefinition } from "../../curriculum/contracts";
import { lessonStages } from "../../learning/stages";
import { attemptKey, type LessonAttemptV2 } from "../../learning/portfolio/schema";
import type { PortfolioPersistenceStatus } from "../../learning/portfolio/repository";
import { InterfaceIcon } from "../Icon";

type LearningRecordsProps = Readonly<{
  lessons: readonly LessonDefinition[];
  attempts: Readonly<Record<string, LessonAttemptV2>>;
  lessonHref: (lesson: LessonDefinition) => string;
  onNavigate: (lesson: LessonDefinition) => void;
}>;

export function LearningRecords(props: LearningRecordsProps): ReactElement {
  const started = props.lessons.flatMap((lesson) => {
    const attempt = props.attempts[attemptKey(lesson.domainId, lesson.id)];
    return attempt && attempt.stage !== "orient" ? [{ lesson, attempt }] : [];
  });
  if (started.length === 0) return <p className="mm-learning-empty">No inquiries started yet. Choose a lesson and begin with a prediction.</p>;
  return <ul className="mm-learning-records">{started.map(({ lesson, attempt }) => <li key={attemptKey(lesson.domainId, lesson.id)}>
    <a href={props.lessonHref(lesson)} onClick={() => props.onNavigate(lesson)}>
      <span>{lesson.title}</span>
      <span className="mm-learning-records__stage">{attempt.stage} · {lessonStages.indexOf(attempt.stage) + 1} of {lessonStages.length}</span>
    </a>
    <span>{attempt.trials.length} recorded {attempt.trials.length === 1 ? "run" : "runs"}</span>
  </li>)}</ul>;
}

export function PortfolioStatus({ status, demoMode }: Readonly<{ status: PortfolioPersistenceStatus; demoMode: boolean }>): ReactElement {
  const saved = status === "saved";
  const label = saved ? "Saved in this browser" : status === "disabled" ? "Automatic saving off"
    : status === "failed" || status === "unavailable" ? "Saving unavailable" : "Local only";
  return <div className="mm-global-status" aria-label="Portfolio storage status">
    <span className={`mm-status-chip ${saved ? "mm-status-chip--local" : "mm-status-chip--caution"}`}>
      <InterfaceIcon name={saved ? "check" : "warning"} />{label}
    </span>
    {demoMode ? <span className="mm-status-chip">Demo data · separate portfolio</span> : null}
  </div>;
}
