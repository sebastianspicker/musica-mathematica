import { useEffect, useRef, useState, type ReactElement } from "react";
import type { LessonDefinition } from "../curriculum/contracts";
import type { CurriculumRegistry } from "../curriculum/registry";
import { attemptKey, type StoragePort } from "../learning/portfolio/schema";
import { lessonStages } from "../learning/stages";
import { CurriculumRail } from "../ui/workbench/CurriculumRail";
import { StageProgress } from "../ui/workbench/InquiryStage";
import { InterfaceIcon } from "../ui/Icon";
import { LearningRecords, PortfolioStatus } from "../ui/workbench/LearningRecords";
import { LessonWorkbenchController } from "./workbench/LessonWorkbenchController";
import { browserStorage } from "./portfolio/browserStorage";
import { usePortfolio } from "./portfolio/usePortfolio";
import { lessonByRoute, lessonRoute } from "./routing/hashRoute";

export type AppProps = Readonly<{
  curriculum: CurriculumRegistry;
  demoMode?: boolean;
  storageFactory?: () => StoragePort | undefined;
}>;

export function App({ curriculum, demoMode = false, storageFactory = browserStorage }: AppProps): ReactElement {
  const [storage] = useState<StoragePort | undefined>(() => storageFactory());
  // Only the location at first render seeds the lesson; later changes arrive through hashchange.
  const [routedLesson] = useState(() => (
    typeof window === "undefined" ? undefined : lessonByRoute(window.location.hash, curriculum)
  ));
  const {
    lesson, portfolio, attempt, persistenceStatus, persistenceMessage,
    selectLesson, replaceAttempt, exportPortfolio, clearAll, setMessage, dismissMessage,
  } = usePortfolio({
    curriculum,
    storage,
    demoMode,
    routedLesson,
  });
  const [presentationMode, setPresentationMode] = useState(false);
  const clearDialogRef = useRef<HTMLDialogElement>(null);
  const lessonsDialogRef = useRef<HTMLDialogElement>(null);
  const learningDialogRef = useRef<HTMLDialogElement>(null);
  const shouldFocusLessonRef = useRef(false);
  const previousTaskRef = useRef({ lesson, stage: attempt.stage });

  function lessonProgress(candidate: LessonDefinition): string | undefined {
    const savedAttempt = portfolio.attempts[attemptKey(candidate.domainId, candidate.id)];
    if (!savedAttempt) return undefined;
    return `${lessonStages.indexOf(savedAttempt.stage) + 1}/${lessonStages.length}`;
  }

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
      selectLesson(next);
      if (next === lesson) document.getElementById("mm-current-task")?.focus();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [curriculum, lesson, selectLesson]);

  useEffect(() => {
    if (!shouldFocusLessonRef.current) return;
    shouldFocusLessonRef.current = false;
    document.getElementById("mm-current-task")?.focus();
  }, [lesson]);

  useEffect(() => {
    const previous = previousTaskRef.current;
    previousTaskRef.current = { lesson, stage: attempt.stage };
    if (previous.lesson === lesson && previous.stage !== attempt.stage) {
      document.querySelector<HTMLElement>(".mm-inquiry .mm-stage-card h2")?.focus();
    }
  }, [attempt.stage, lesson]);

  function clearAllLearning(): void {
    clearAll();
    clearDialogRef.current?.close();
  }

  return (
    <main className={presentationMode ? "mm-app mm-app--presentation" : "mm-app"}>
      <a className="skip-link" href="#mm-current-task">Skip to current task</a>
      <header className="mm-global-header">
        <div className="mm-brand-lockup">
          <div><span>Musica Mathematica</span></div>
        </div>
        <nav className="mm-global-actions" aria-label="Notebook navigation">
          <button id="mm-curriculum-toggle" aria-haspopup="dialog" aria-controls="mm-lessons-dialog" type="button" onClick={(event) => { event.currentTarget.focus(); lessonsDialogRef.current?.showModal(); }}>Lessons</button>
          <button aria-haspopup="dialog" aria-controls="mm-learning-dialog" type="button" onClick={(event) => { event.currentTarget.focus(); learningDialogRef.current?.showModal(); }}>My learning</button>
          {presentationMode ? <button type="button" aria-label="Exit presentation" aria-pressed={presentationMode} onClick={() => setPresentationMode(false)}>Exit presentation</button> : null}
        </nav>
      </header>
      {persistenceMessage ? (
        <p className="mm-global-message" role="status">
          <span>{persistenceMessage}</span>
          <button aria-label="Dismiss message" className="mm-global-message__dismiss" type="button" onClick={dismissMessage}>
            <InterfaceIcon name="close" />
          </button>
        </p>
      ) : null}
      <div className="mm-shell">
        <div className="mm-lesson-area">
          <StageProgress stage={attempt.stage} />
          <LessonWorkbenchController
            attempt={attempt}
            curriculum={curriculum}
            debriefActions={<div className="mm-debrief-actions">
              <PortfolioStatus status={persistenceStatus} demoMode={demoMode} />
              <div className="mm-debrief-actions__buttons">
                <button className="mm-primary-action" type="button" aria-label="Export portfolio" onClick={exportPortfolio}>Export portfolio JSON</button>
                <button className="mm-text-action" type="button" onClick={(event) => { event.currentTarget.focus(); lessonsDialogRef.current?.showModal(); }}>Browse lessons</button>
              </div>
              <p>Stored only in this browser. Export is a download; it cannot be imported here.</p>
            </div>}
            initialFactors={demoMode ? attempt.trials[0]?.factors : undefined}
            key={`${lesson.domainId}:${lesson.id}`}
            lesson={lesson}
            onAttemptChange={replaceAttempt}
            onPersistenceMessage={setMessage}
          />
        </div>
      </div>
      <footer className="mm-notebook-footer">
        <PortfolioStatus status={persistenceStatus} demoMode={demoMode} />
        <span>Your learning record stays in this browser.</span>
      </footer>
      <dialog id="mm-lessons-dialog" aria-labelledby="mm-lessons-heading" className="mm-notebook-dialog" ref={lessonsDialogRef}>
        <div className="mm-dialog-heading"><h2 id="mm-lessons-heading">Choose your inquiry</h2><button type="button" aria-label="Close lessons" onClick={() => lessonsDialogRef.current?.close()}>Close</button></div>
        <CurriculumRail
          activeDomainId={lesson.domainId}
          activeLessonId={lesson.id}
          domains={curriculum.catalog}
          lessonHref={lessonRoute}
          lessonProgress={lessonProgress}
          onNavigate={(next) => {
            lessonsDialogRef.current?.close();
            if (next === lesson) document.getElementById("mm-current-task")?.focus();
          }}
        />
      </dialog>
      <dialog id="mm-learning-dialog" aria-labelledby="mm-learning-heading" className="mm-notebook-dialog" ref={learningDialogRef}>
        <div className="mm-dialog-heading"><h2 id="mm-learning-heading">My learning</h2><button type="button" aria-label="Close my learning" onClick={() => learningDialogRef.current?.close()}>Close</button></div>
        <PortfolioStatus status={persistenceStatus} demoMode={demoMode} />
        <p className="mm-learning-intro">Revisit your inquiries and the reasoning you recorded. Progress marks inquiry stages, not grades.</p>
        {persistenceMessage ? <p className="mm-learning-feedback" role="status">{persistenceMessage}</p> : null}
        <LearningRecords
          lessons={curriculum.catalog.flatMap((domain) => domain.lessons)}
          attempts={portfolio.attempts}
          lessonHref={lessonRoute}
          onNavigate={(next) => {
            learningDialogRef.current?.close();
            if (next === lesson) document.getElementById("mm-current-task")?.focus();
          }}
        />
        <div className="mm-learning-actions">
          <button className="mm-primary-action" aria-label="Export portfolio" type="button" onClick={exportPortfolio}>Export portfolio JSON</button>
          <button aria-label={presentationMode ? "Exit presentation" : "Presentation mode"} aria-pressed={presentationMode} type="button" onClick={() => {
            setPresentationMode((value) => !value);
            learningDialogRef.current?.close();
          }}>{presentationMode ? "Exit presentation" : "Presentation mode"}</button>
          <button aria-label="Clear local work" className="mm-text-danger" type="button" onClick={() => {
            learningDialogRef.current?.close();
            clearDialogRef.current?.showModal();
          }}>{demoMode ? "Reset demo data" : "Clear local work"}</button>
        </div>
        <p className="mm-learning-limit">Export downloads a JSON record. Import and cross-device sync are not available.</p>
      </dialog>
      <dialog aria-labelledby="mm-clear-dialog-heading" className="mm-confirm-dialog" ref={clearDialogRef}>
        <form method="dialog">
          <div className="mm-confirm-dialog__icon" aria-hidden="true"><InterfaceIcon name="warning" /></div>
          <h2 id="mm-clear-dialog-heading">{demoMode ? "Reset the demo?" : "Clear all local work?"}</h2>
          <p>
            {demoMode
              ? "This restores the deterministic comparison included with the demo. Your ordinary Musica Mathematica portfolio is separate and will not be changed."
              : "This removes every Musica Mathematica learning record stored in this browser, including the migrated ensemble record. Exported files are not removed."}
          </p>
          <div className="mm-confirm-dialog__actions">
            <button value="cancel">Keep my work</button>
            <button className="mm-danger-action" type="button" onClick={clearAllLearning}>
              {demoMode ? "Reset demo data" : "Clear all local work"}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
