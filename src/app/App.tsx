import { useEffect, useRef, useState, type ReactElement } from "react";
import type { LessonDefinition } from "../curriculum/contracts";
import type { CurriculumRegistry } from "../curriculum/registry";
import { activeAttempt, createPortfolio, selectLesson, updateAttempt } from "../learning/portfolio/aggregate";
import { clearPortfolio, exportPortfolioJson, loadPortfolio, savePortfolio } from "../learning/portfolio/repository";
import type { LearningPortfolioV2, LessonAttemptV2 } from "../learning/portfolio/schema-v2";
import { CurriculumRail } from "../ui/workbench/CurriculumRail";
import { InterfaceIcon } from "../ui/Icon";
import { LessonWorkbenchController } from "./workbench/LessonWorkbenchController";
import { browserStorage } from "./portfolio/browserStorage";
import { downloadPortfolioJson } from "./portfolio/download";
import { lessonByRoute, lessonRoute } from "./routing/hashRoute";

const STORAGE_UNAVAILABLE = "Browser storage is unavailable. Export the portfolio before leaving.";

type InitialAppState = Readonly<{
  lesson: LessonDefinition;
  portfolio: LearningPortfolioV2;
}>;

function initialAppState(curriculum: CurriculumRegistry): InitialAppState {
  const storage = browserStorage();
  const loaded = loadPortfolio(storage, curriculum);
  const routed = typeof window === "undefined" ? undefined : lessonByRoute(window.location.hash, curriculum);
  const selected = routed ?? curriculum.lessonById(loaded.active.labId, loaded.active.lessonId) ?? curriculum.defaultLesson;
  return {
    lesson: selected,
    portfolio: selectLesson(curriculum, loaded, selected.domainId, selected.id),
  };
}

export type AppProps = Readonly<{ curriculum: CurriculumRegistry }>;

export function App({ curriculum }: AppProps): ReactElement {
  const [initial] = useState(() => initialAppState(curriculum));
  const [lesson, setLesson] = useState(initial.lesson);
  const [portfolio, setPortfolio] = useState(initial.portfolio);
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const clearDialogRef = useRef<HTMLDialogElement>(null);
  const skipPersistenceForRef = useRef<LearningPortfolioV2 | null>(null);
  const shouldFocusLessonRef = useRef(false);
  const attempt = activeAttempt(curriculum, portfolio);

  useEffect(() => {
    const expected = lessonRoute(lesson);
    if (window.location.hash !== expected) window.history.replaceState(null, "", expected);
  }, [lesson]);

  useEffect(() => {
    const onHashChange = (): void => {
      const next = lessonByRoute(window.location.hash, curriculum);
      if (!next) {
        window.history.replaceState(null, "", lessonRoute(lesson));
        return;
      }
      shouldFocusLessonRef.current = next !== lesson;
      setLesson(next);
      setPortfolio((current) => selectLesson(curriculum, current, next.domainId, next.id));
      if (next === lesson) document.getElementById("mm-current-task")?.focus();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [curriculum, lesson]);

  useEffect(() => {
    if (!shouldFocusLessonRef.current) return;
    shouldFocusLessonRef.current = false;
    document.getElementById("mm-current-task")?.focus();
  }, [lesson]);

  useEffect(() => {
    if (skipPersistenceForRef.current === portfolio) return;
    if (!savePortfolio(portfolio, browserStorage(), curriculum)) setPersistenceMessage(STORAGE_UNAVAILABLE);
  }, [curriculum, portfolio]);

  function replaceAttempt(next: LessonAttemptV2): void {
    setPortfolio((current) => updateAttempt(curriculum, current, next));
  }

  function exportPortfolio(): void {
    const json = exportPortfolioJson(portfolio, curriculum);
    if (!json) {
      setPersistenceMessage("The portfolio could not be exported.");
      return;
    }
    downloadPortfolioJson(json);
    setPersistenceMessage("Portfolio exported. The file remains under your control.");
  }

  function clearAllLearning(): void {
    const cleared = clearPortfolio(browserStorage());
    const empty = selectLesson(curriculum, createPortfolio(curriculum), lesson.domainId, lesson.id);
    skipPersistenceForRef.current = empty;
    setPortfolio(empty);
    clearDialogRef.current?.close();
    setPersistenceMessage(cleared
      ? "All local learning records were cleared."
      : "Storage could not be cleared; use the browser's site-data controls.");
  }

  return (
    <main className={presentationMode ? "mm-app mm-app--presentation" : "mm-app"}>
      <a className="skip-link" href="#mm-current-task">Skip to current task</a>
      <header className="mm-global-header">
        <div className="mm-brand-lockup">
          <span className="mm-brand-mark" aria-hidden="true">M</span>
          <div><span>Musica Mathematica</span><p>Music, represented mathematically</p></div>
        </div>
        <div className="mm-global-status" aria-label="Privacy and calibration status">
          <span className="mm-status-chip mm-status-chip--local">
            <span className="mm-status-chip__dot" aria-hidden="true" />
            Local only
          </span>
          <span className="mm-status-chip mm-status-chip--caution">
            <span className="mm-status-chip__dot" aria-hidden="true" />
            Uncalibrated
          </span>
        </div>
        <div className="mm-global-actions">
          <button
            aria-label={presentationMode ? "Exit presentation" : "Presentation mode"}
            type="button"
            onClick={() => {
              setPresentationMode((value) => !value);
            }}
          >
            <InterfaceIcon name="present" />
            <span>{presentationMode ? "Exit" : "Present"}</span>
          </button>
          <button aria-label="Export portfolio" type="button" onClick={exportPortfolio}>
            <InterfaceIcon name="export" />
            <span>Export</span>
          </button>
          <button
            aria-label="Clear local work"
            className="mm-text-danger"
            type="button"
            onClick={() => {
              clearDialogRef.current?.showModal();
            }}
          >
            <InterfaceIcon name="trash" />
            <span>Clear work</span>
          </button>
        </div>
      </header>
      {persistenceMessage ? (
        <p className="mm-global-message" role="status">
          <span>{persistenceMessage}</span>
          <button aria-label="Dismiss message" className="mm-global-message__dismiss" type="button" onClick={() => {
            setPersistenceMessage(null);
          }}>
            <InterfaceIcon name="close" />
          </button>
        </p>
      ) : null}
      <div className="mm-shell">
        <CurriculumRail activeDomainId={lesson.domainId} activeLessonId={lesson.id} domains={curriculum.catalog} lessonHref={lessonRoute} />
        <LessonWorkbenchController attempt={attempt} curriculum={curriculum} key={`${lesson.domainId}:${lesson.id}`} lesson={lesson} onAttemptChange={replaceAttempt} onPersistenceMessage={setPersistenceMessage} />
      </div>
      <dialog aria-labelledby="mm-clear-dialog-heading" className="mm-confirm-dialog" ref={clearDialogRef}>
        <form method="dialog">
          <div className="mm-confirm-dialog__icon" aria-hidden="true"><InterfaceIcon name="warning" /></div>
          <h2 id="mm-clear-dialog-heading">Clear all local work?</h2>
          <p>
            This removes every Musica Mathematica learning record stored in this browser,
            including the migrated ensemble record. Exported files are not removed.
          </p>
          <div className="mm-confirm-dialog__actions">
            <button value="cancel">Keep my work</button>
            <button className="mm-danger-action" type="button" onClick={clearAllLearning}>
              Clear all local work
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
