import { useCallback, useEffect, useRef, useState } from "react";
import type { LessonDefinition } from "../../curriculum/contracts";
import type { CurriculumRegistry } from "../../curriculum/registry";
import { activeAttempt, createPortfolio, selectLesson, updateAttempt } from "../../learning/portfolio/aggregate";
import {
  clearPortfolio,
  exportPortfolioJson,
  loadPortfolioDetailed,
  portfolioNormalizationNotice,
  savePortfolioDetailed,
  type PortfolioPersistenceStatus,
  type PortfolioSaveResult,
} from "../../learning/portfolio/repository";
import type { LearningPortfolioV2, LessonAttemptV2, StoragePort } from "../../learning/portfolio/schema";
import { isLessonAttemptV2, normalizeLessonAttempt } from "../../learning/portfolio/validate";
import { downloadPortfolioJson } from "./download";

export type AutosaveOutcome = Readonly<{
  persistenceStatus: PortfolioPersistenceStatus;
  disableAutomaticPersistence: boolean;
  message?: string;
  /** A normalized portfolio that replaces the saved one and must not be saved again. */
  replacement?: LearningPortfolioV2;
}>;

export function autosaveOutcome(saved: PortfolioSaveResult): AutosaveOutcome {
  const replaced = saved.portfolio && (saved.normalizationStatus === "normalized"
    || saved.normalizationStatus === "compacted");
  return {
    persistenceStatus: saved.persistenceStatus,
    disableAutomaticPersistence: saved.persistenceStatus === "disabled",
    message: saved.notice,
    replacement: replaced ? saved.portfolio : undefined,
  };
}

export type ClearOutcome = Readonly<{
  persistenceStatus: PortfolioPersistenceStatus;
  enableAutomaticPersistence: boolean;
  message: string;
}>;

export function clearOutcome(cleared: boolean, demoMode: boolean): ClearOutcome {
  return {
    persistenceStatus: cleared ? "not-needed" : "failed",
    enableAutomaticPersistence: cleared,
    message: cleared
      ? demoMode ? "Demo data was reset." : "All local learning records were cleared."
      : "Storage could not be cleared; use the browser's site-data controls.",
  };
}

export type UsePortfolioOptions = Readonly<{
  curriculum: CurriculumRegistry;
  storage: StoragePort | undefined;
  demoMode: boolean;
  /** Lesson named by the location, which takes precedence over the saved active lesson. */
  routedLesson: LessonDefinition | undefined;
}>;

export type PortfolioController = Readonly<{
  lesson: LessonDefinition;
  portfolio: LearningPortfolioV2;
  attempt: LessonAttemptV2;
  persistenceStatus: PortfolioPersistenceStatus;
  persistenceMessage: string | null;
  selectLesson: (lesson: LessonDefinition) => void;
  replaceAttempt: (attempt: LessonAttemptV2) => void;
  exportPortfolio: () => void;
  clearAll: () => void;
  setMessage: (message: string | null) => void;
  dismissMessage: () => void;
}>;

export function usePortfolio({ curriculum, storage, demoMode, routedLesson }: UsePortfolioOptions): PortfolioController {
  const [initial] = useState(() => {
    const loaded = loadPortfolioDetailed(storage, curriculum);
    const selected = routedLesson
      ?? curriculum.lessonById(loaded.portfolio.active.labId, loaded.portfolio.active.lessonId)
      ?? curriculum.defaultLesson;
    return {
      lesson: selected,
      portfolio: selectLesson(curriculum, loaded.portfolio, selected.domainId, selected.id),
      automaticPersistenceEnabled: loaded.automaticPersistenceEnabled,
      persistenceMessage: loaded.notice ?? null,
      persistenceStatus: loaded.persistenceStatus,
    };
  });
  const [lesson, setLesson] = useState(initial.lesson);
  const [portfolio, setPortfolio] = useState(initial.portfolio);
  const [automaticPersistenceEnabled, setAutomaticPersistenceEnabled] = useState(initial.automaticPersistenceEnabled);
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(initial.persistenceMessage);
  const [persistenceStatus, setPersistenceStatus] = useState(initial.persistenceStatus);
  const skipPersistenceForRef = useRef<LearningPortfolioV2 | null>(null);

  useEffect(() => {
    if (!automaticPersistenceEnabled) return;
    if (skipPersistenceForRef.current === portfolio) return;
    const outcome = autosaveOutcome(savePortfolioDetailed(portfolio, storage, curriculum));
    setPersistenceStatus(outcome.persistenceStatus);
    if (outcome.disableAutomaticPersistence) setAutomaticPersistenceEnabled(false);
    if (outcome.message) setPersistenceMessage(outcome.message);
    if (outcome.replacement) {
      skipPersistenceForRef.current = outcome.replacement;
      setPortfolio(outcome.replacement);
    }
  }, [automaticPersistenceEnabled, curriculum, portfolio, storage]);

  const selectLessonInPortfolio = useCallback((next: LessonDefinition): void => {
    setLesson(next);
    setPortfolio((current) => selectLesson(curriculum, current, next.domainId, next.id));
  }, [curriculum]);

  function replaceAttempt(next: LessonAttemptV2): void {
    const normalized = normalizeLessonAttempt(next, curriculum);
    if (!normalized) return;
    setPortfolio((current) => updateAttempt(curriculum, current, normalized));
    if (!isLessonAttemptV2(next, curriculum)) {
      setPersistenceMessage(portfolioNormalizationNotice);
    }
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

  function clearAll(): void {
    const cleared = clearPortfolio(storage);
    const reset = demoMode
      ? loadPortfolioDetailed(storage, curriculum).portfolio
      : createPortfolio(curriculum);
    const next = selectLesson(curriculum, reset, lesson.domainId, lesson.id);
    const outcome = clearOutcome(cleared, demoMode);
    skipPersistenceForRef.current = next;
    setPortfolio(next);
    setPersistenceStatus(outcome.persistenceStatus);
    if (outcome.enableAutomaticPersistence) setAutomaticPersistenceEnabled(true);
    setPersistenceMessage(outcome.message);
  }

  return {
    lesson,
    portfolio,
    attempt: activeAttempt(curriculum, portfolio),
    persistenceStatus,
    persistenceMessage,
    selectLesson: selectLessonInPortfolio,
    replaceAttempt,
    exportPortfolio,
    clearAll,
    setMessage: setPersistenceMessage,
    dismissMessage: () => { setPersistenceMessage(null); },
  };
}
