import { migrateLegacyRecord } from "../legacy-v1/migration";
import { createPortfolio } from "./aggregate";
import { legacyPortfolioStorageKey, portfolioStorageKey } from "./constants";
import type { StoragePort } from "./ports";
import type { CurriculumLessonReader } from "../../curriculum/contracts";
import type { LearningPortfolioV2 } from "./schema-v2";
import { isLearningPortfolioV2, sanitizePortfolio } from "./validate";

/** Persistence boundary: all browser access is injected through StoragePort. */
export function loadPortfolio(
  storage: StoragePort | undefined,
  curriculum: CurriculumLessonReader,
  now = new Date().toISOString(),
): LearningPortfolioV2 {
  if (!storage) return createPortfolio(curriculum);

  const storedPortfolio = loadV2Portfolio(storage, curriculum);
  if (storedPortfolio) return storedPortfolio;

  const migratedPortfolio = migrateLegacyRecord(storage, curriculum, now);
  if (!migratedPortfolio) return createPortfolio(curriculum);

  writeMigratedPortfolio(storage, migratedPortfolio);
  return migratedPortfolio;
}

export function savePortfolio(
  portfolio: LearningPortfolioV2,
  storage: StoragePort | undefined,
  curriculum: CurriculumLessonReader,
): boolean {
  if (!storage || !isLearningPortfolioV2(portfolio, curriculum)) return false;
  try {
    storage.setItem(portfolioStorageKey, JSON.stringify(sanitizePortfolio(portfolio, curriculum)));
    return true;
  } catch {
    return false;
  }
}

export function clearPortfolio(storage: StoragePort | undefined): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(portfolioStorageKey);
    storage.removeItem(legacyPortfolioStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function exportPortfolioJson(portfolio: LearningPortfolioV2, curriculum: CurriculumLessonReader): string | undefined {
  return isLearningPortfolioV2(portfolio, curriculum)
    ? JSON.stringify(sanitizePortfolio(portfolio, curriculum), null, 2)
    : undefined;
}

function loadV2Portfolio(storage: StoragePort, curriculum: CurriculumLessonReader): LearningPortfolioV2 | undefined {
  try {
    const raw = storage.getItem(portfolioStorageKey);
    if (raw === null) return undefined;

    const parsed: unknown = JSON.parse(raw);
    return isLearningPortfolioV2(parsed, curriculum) ? sanitizePortfolio(parsed, curriculum) : undefined;
  } catch {
    // A corrupt v2 record must not block use or a valid legacy migration.
    return undefined;
  }
}

function writeMigratedPortfolio(storage: StoragePort, portfolio: LearningPortfolioV2): void {
  try {
    storage.setItem(portfolioStorageKey, JSON.stringify(portfolio));
  } catch {
    // The migration remains usable in memory when persistence is unavailable.
  }
}
