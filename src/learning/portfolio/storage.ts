import { learningRecordStorageKey as legacyLearningRecordStorageKey, type LearningRecordStorage } from "../localLearningRecord";
import { createPortfolio } from "./attempt";
import { portfolioStorageKey } from "./constants";
import { migrateLegacyRecord } from "./migrate";
import type { LearningPortfolioV2 } from "./types";
import { isLearningPortfolioV2, sanitizePortfolio } from "./validate";

export function loadPortfolio(
  storage: LearningRecordStorage | undefined = browserStorage(),
  now = new Date().toISOString(),
): LearningPortfolioV2 {
  if (!storage) return createPortfolio();
  try {
    const raw = storage.getItem(portfolioStorageKey);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (isLearningPortfolioV2(parsed)) return sanitizePortfolio(parsed);
    }
  } catch {
    // A corrupt v2 record must not block use or a valid legacy migration.
  }

  const migrated = migrateLegacyRecord(storage, now);
  if (!migrated) return createPortfolio();
  try {
    storage.setItem(portfolioStorageKey, JSON.stringify(migrated));
  } catch {
    // Migration remains usable in memory when browser storage is unavailable.
  }
  return migrated;
}

export function savePortfolio(
  portfolio: LearningPortfolioV2,
  storage: LearningRecordStorage | undefined = browserStorage(),
): boolean {
  if (!storage || !isLearningPortfolioV2(portfolio)) return false;
  try {
    storage.setItem(portfolioStorageKey, JSON.stringify(sanitizePortfolio(portfolio)));
    return true;
  } catch {
    return false;
  }
}

export function clearPortfolio(
  storage: LearningRecordStorage | undefined = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(portfolioStorageKey);
    storage.removeItem(legacyLearningRecordStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function exportPortfolioJson(portfolio: LearningPortfolioV2): string | undefined {
  return isLearningPortfolioV2(portfolio) ? JSON.stringify(sanitizePortfolio(portfolio), null, 2) : undefined;
}

function browserStorage(): LearningRecordStorage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
