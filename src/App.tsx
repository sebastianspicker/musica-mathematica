import { useEffect, useRef, useState, type ReactElement } from "react";
import { defaultLabLesson, labCatalog, labLessonById, lessonByRoute } from "./labs/catalog";
import { lessonRoute, type LabLesson } from "./labs/types";
import {
  activeAttempt,
  clearPortfolio,
  createPortfolio,
  exportPortfolioJson,
  loadPortfolio,
  savePortfolio,
  selectLesson,
  updateAttempt,
  type LearningPortfolioV2,
  type LessonAttemptV2,
} from "./learning/portfolio";
import { CurriculumRail } from "./components/workbench/CurriculumRail";
import { LessonWorkbench } from "./components/workbench/LessonWorkbench";
import { InterfaceIcon } from "./components/InterfaceIcon";

const STORAGE_UNAVAILABLE = "Browser storage is unavailable. Export the portfolio before leaving.";

type InitialAppState = Readonly<{
  lesson: LabLesson;
  portfolio: LearningPortfolioV2;
}>;

function initialAppState(): InitialAppState {
  const loaded = loadPortfolio();
  const routed = typeof window === "undefined" ? undefined : lessonByRoute(window.location.hash);
  const selected = routed ?? labLessonById(loaded.active.labId, loaded.active.lessonId) ?? defaultLabLesson;
  return {
    lesson: selected,
    portfolio: selectLesson(loaded, selected.labId, selected.id),
  };
}

export function App(): ReactElement {
  const [initial] = useState(initialAppState);
  const [lesson, setLesson] = useState(initial.lesson);
  const [portfolio, setPortfolio] = useState(initial.portfolio);
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const clearDialogRef = useRef<HTMLDialogElement>(null);
  const skipPersistenceForRef = useRef<LearningPortfolioV2 | null>(null);
  const shouldFocusLessonRef = useRef(false);
  const attempt = activeAttempt(portfolio);

  useEffect(() => {
    const expected = lessonRoute(lesson);
    if (window.location.hash !== expected) window.history.replaceState(null, "", expected);
  }, [lesson]);

  useEffect(() => {
    const onHashChange = (): void => {
      const next = lessonByRoute(window.location.hash);
      if (!next) {
        window.history.replaceState(null, "", lessonRoute(lesson));
        return;
      }
      shouldFocusLessonRef.current = next !== lesson;
      setLesson(next);
      setPortfolio((current) => selectLesson(current, next.labId, next.id));
      if (next === lesson) document.getElementById("mm-current-task")?.focus();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [lesson]);

  useEffect(() => {
    if (!shouldFocusLessonRef.current) return;
    shouldFocusLessonRef.current = false;
    document.getElementById("mm-current-task")?.focus();
  }, [lesson]);

  useEffect(() => {
    if (skipPersistenceForRef.current === portfolio) return;
    if (!savePortfolio(portfolio)) setPersistenceMessage(STORAGE_UNAVAILABLE);
  }, [portfolio]);

  function replaceAttempt(next: LessonAttemptV2): void {
    setPortfolio((current) => updateAttempt(current, next));
  }

  function exportPortfolio(): void {
    const json = exportPortfolioJson(portfolio);
    if (!json) {
      setPersistenceMessage("The portfolio could not be exported.");
      return;
    }
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "musica-mathematica-portfolio.json";
    link.click();
    URL.revokeObjectURL(url);
    setPersistenceMessage("Portfolio exported. The file remains under your control.");
  }

  function clearAllLearning(): void {
    const cleared = clearPortfolio();
    const empty = selectLesson(createPortfolio(), lesson.labId, lesson.id);
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
        <CurriculumRail activeLabId={lesson.labId} activeLessonId={lesson.id} domains={labCatalog} />
        <LessonWorkbench attempt={attempt} key={`${lesson.labId}:${lesson.id}`} lesson={lesson} onAttemptChange={replaceAttempt} onPersistenceMessage={setPersistenceMessage} />
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
