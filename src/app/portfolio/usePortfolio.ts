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
import { legacyPortfolioStorageKey, portfolioBackupStorageKey, type LearningPortfolioV2, type LessonAttemptV2, type StoragePort } from "../../learning/portfolio/schema";
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

/** Storage keys written by this app; on GitHub Pages other project sites share the origin's storage. */
export function isPortfolioStorageKey(key: string | null): boolean {
  return key === null || key === legacyPortfolioStorageKey
    || key.startsWith("musicaMathematica.") && key !== portfolioBackupStorageKey;
}

export type PortfolioReload = Readonly<{
  /** Absent when this tab must keep the work it holds. */
  portfolio?: LearningPortfolioV2;
  persistenceStatus: PortfolioPersistenceStatus;
  automaticPersistenceEnabled: boolean;
  notice?: string;
}>;

const OTHER_TAB_UNREADABLE_NOTICE =
  "Another tab saved learning data this tab cannot read. Automatic saving is off here so that data is not overwritten; reload the page to continue.";

/** Re-reads storage after another tab wrote it, keeping this tab on its own lesson. */
export function reloadPortfolio(
  storage: StoragePort | undefined,
  curriculum: CurriculumRegistry,
  lesson: LessonDefinition,
): PortfolioReload {
  // Only the backup may be written, so tabs running different builds cannot keep rewriting each other's copy.
  const readOnly = storage && {
    getItem: (key: string) => storage.getItem(key),
    setItem: (key: string, value: string) => { if (key === portfolioBackupStorageKey) storage.setItem(key, value); },
    removeItem: () => undefined,
  };
  const loaded = loadPortfolioDetailed(readOnly, curriculum);
  const cleared = loaded.source === "empty" && loaded.normalizationStatus === "unchanged" && loaded.persistenceStatus === "not-needed";
  if (loaded.source !== "v2" && !cleared) {
    // Unreadable or unavailable storage (or a legacy record behind it) must not replace the work this tab holds.
    return loaded.persistenceStatus === "unavailable"
      ? { persistenceStatus: loaded.persistenceStatus, automaticPersistenceEnabled: false, notice: loaded.notice }
      : { persistenceStatus: "disabled", automaticPersistenceEnabled: false, notice: OTHER_TAB_UNREADABLE_NOTICE };
  }
  return {
    portfolio: selectLesson(curriculum, loaded.portfolio, lesson.domainId, lesson.id),
    // What another tab stored is already saved; only an empty store is local-only.
    persistenceStatus: loaded.source !== "empty" && loaded.persistenceStatus === "not-needed" ? "saved" : loaded.persistenceStatus,
    automaticPersistenceEnabled: loaded.automaticPersistenceEnabled,
    // A trimming notice describes the other tab's save; only a reason saving stopped matters here.
    notice: loaded.automaticPersistenceEnabled ? undefined : loaded.notice,
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

  useEffect(() => {
    // shortcut: two tabs saving in the same instant can still lose one write; merge per attempt if that is reported.
    const onStorage = (event: StorageEvent): void => {
      if (!isPortfolioStorageKey(event.key)) return;
      const reloaded = reloadPortfolio(storage, curriculum, lesson);
      if (reloaded.portfolio) {
        // Without the skip, the reloaded copy (with this tab's active lesson) would be written back and start a loop.
        skipPersistenceForRef.current = reloaded.portfolio;
        setPortfolio(reloaded.portfolio);
      }
      setPersistenceStatus(reloaded.persistenceStatus);
      setAutomaticPersistenceEnabled(reloaded.automaticPersistenceEnabled);
      if (reloaded.notice) setPersistenceMessage(reloaded.notice);
    };
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("storage", onStorage); };
  }, [curriculum, lesson, storage]);

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
