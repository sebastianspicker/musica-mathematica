import type { CurriculumLessonReader } from "../../curriculum/contracts";
import { migrateLegacyJson } from "./legacy/migration";
import { createPortfolio } from "./aggregate";
import {
  preparePortfolio,
  type PortfolioNormalizationStatus,
  utf8ByteLength,
} from "./compact";
import {
  legacyPortfolioStorageKey,
  maximumRawPortfolioJsonBytes,
  portfolioStorageKey,
  portfolioBackupStorageKey,
  type StoragePort,
  type LearningPortfolioV2,
} from "./schema";

export type PortfolioPersistenceStatus =
  | "not-needed"
  | "saved"
  | "failed"
  | "unavailable"
  | "disabled";

export type PortfolioLoadResult = Readonly<{
  portfolio: LearningPortfolioV2;
  source: "v2" | "legacy" | "empty";
  normalizationStatus: PortfolioNormalizationStatus;
  persistenceStatus: PortfolioPersistenceStatus;
  automaticPersistenceEnabled: boolean;
  notice?: string;
}>;

export type PortfolioSaveResult = Readonly<{
  portfolio?: LearningPortfolioV2;
  normalizationStatus: PortfolioNormalizationStatus;
  persistenceStatus: PortfolioPersistenceStatus;
  byteLength?: number;
  notice?: string;
}>;

type StoredValue =
  | Readonly<{ status: "missing" }>
  | Readonly<{ status: "failed" }>
  | Readonly<{ status: "oversized" }>
  | Readonly<{ status: "available"; raw: string }>;

const STORAGE_UNAVAILABLE_NOTICE =
  "Browser storage is unavailable. Export the portfolio before leaving.";
const RECOVERY_NOTICE =
  "Stored learning data is too large to open safely. Automatic saving is off and the original browser data remains unchanged. Clear local work to recover automatic saving.";
const UNREADABLE_BLOCKED_NOTICE =
  "Stored learning data could not be read, and no copy of it could be kept. Automatic saving is off and the original browser data remains unchanged. Clear local work to recover automatic saving.";
const UNREADABLE_NOTICE =
  "Saved learning data could not be read, so a new portfolio was started. A copy of the unreadable data was kept in this browser until you clear local work.";
const LOSSY_BLOCKED_NOTICE =
  "Some saved learning data cannot be opened by this version, and no copy of it could be kept. Automatic saving is off and the original browser data remains unchanged. Export your work, then clear local work to recover automatic saving.";
// Autosave writes only the v2 key, so the older record stays until local work is cleared.
const LEGACY_UNCONVERTIBLE_NOTICE =
  "Learning data saved by an older version could not be converted, so a new portfolio was started. The older data was left unchanged in this browser until you clear local work.";
export const portfolioNormalizationNotice =
  "Portfolio content was trimmed to browser-safe limits before saving.";

/** Persistence boundary: all browser access is injected through StoragePort. */
export function loadPortfolioDetailed(
  storage: StoragePort | undefined,
  curriculum: CurriculumLessonReader,
  now = new Date().toISOString(),
): PortfolioLoadResult {
  if (!storage) return unavailableLoad(curriculum);

  const storedV2 = readStoredValue(storage, portfolioStorageKey);
  if (storedV2.status === "failed") return unavailableLoad(curriculum);
  if (storedV2.status === "oversized") return blockedLoad(curriculum);
  if (storedV2.status === "available") {
    const loaded = loadPreparedV2(storedV2.raw, storage, curriculum);
    if (loaded) return loaded;
    // The next save replaces the unreadable value, so keep a copy first or do not save at all.
    if (!backUpStoredPortfolio(storage, storedV2.raw, true)) return blockedLoad(curriculum, UNREADABLE_BLOCKED_NOTICE);
  }
  const unreadable = storedV2.status === "available";

  const storedLegacy = readStoredValue(storage, legacyPortfolioStorageKey);
  if (storedLegacy.status === "failed") return unavailableLoad(curriculum);
  if (storedLegacy.status === "oversized") return blockedLoad(curriculum);
  let legacyUnconvertible = false;
  if (storedLegacy.status === "available") {
    const migrated = migrateLegacyJson(storedLegacy.raw, curriculum, now);
    if (migrated) {
      const loaded = loadMigrated(migrated, storage, curriculum);
      return unreadable ? withUnreadableNotice(loaded) : loaded;
    }
    legacyUnconvertible = true;
  }

  const empty: PortfolioLoadResult = {
    portfolio: createPortfolio(curriculum),
    source: "empty",
    normalizationStatus: unreadable ? "invalid" : "unchanged",
    persistenceStatus: "not-needed",
    automaticPersistenceEnabled: true,
    ...(legacyUnconvertible ? { notice: LEGACY_UNCONVERTIBLE_NOTICE } : {}),
  };
  return unreadable ? withUnreadableNotice(empty) : empty;
}

export function savePortfolioDetailed(
  portfolio: LearningPortfolioV2,
  storage: StoragePort | undefined,
  curriculum: CurriculumLessonReader,
): PortfolioSaveResult {
  const prepared = preparePortfolio(portfolio, curriculum);
  if (!prepared.portfolio || !prepared.json || prepared.normalizationStatus === "blocked") {
    return {
      portfolio: prepared.portfolio,
      normalizationStatus: prepared.normalizationStatus,
      persistenceStatus: "disabled",
      byteLength: prepared.byteLength,
      notice: prepared.normalizationStatus === "blocked" ? RECOVERY_NOTICE : undefined,
    };
  }
  if (!storage) {
    return {
      portfolio: prepared.portfolio,
      normalizationStatus: prepared.normalizationStatus,
      persistenceStatus: "unavailable",
      byteLength: prepared.byteLength,
      notice: STORAGE_UNAVAILABLE_NOTICE,
    };
  }

  try {
    storage.setItem(portfolioStorageKey, prepared.json);
    return {
      portfolio: prepared.portfolio,
      normalizationStatus: prepared.normalizationStatus,
      persistenceStatus: "saved",
      byteLength: prepared.byteLength,
      ...(prepared.normalizationStatus === "unchanged"
        ? {}
        : { notice: portfolioNormalizationNotice }),
    };
  } catch {
    return {
      portfolio: prepared.portfolio,
      normalizationStatus: prepared.normalizationStatus,
      persistenceStatus: "failed",
      byteLength: prepared.byteLength,
      notice: STORAGE_UNAVAILABLE_NOTICE,
    };
  }
}

export function clearPortfolio(storage: StoragePort | undefined): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(portfolioStorageKey);
    storage.removeItem(legacyPortfolioStorageKey);
    storage.removeItem(portfolioBackupStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function exportPortfolioJson(
  portfolio: LearningPortfolioV2,
  curriculum: CurriculumLessonReader,
): string | undefined {
  return preparePortfolio(portfolio, curriculum).json;
}

function loadPreparedV2(
  raw: string,
  storage: StoragePort,
  curriculum: CurriculumLessonReader,
): PortfolioLoadResult | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const prepared = preparePortfolio(parsed, curriculum);
  if (!prepared.portfolio) return undefined;
  if (!prepared.json || prepared.normalizationStatus === "blocked") {
    return {
      portfolio: prepared.portfolio,
      source: "v2",
      normalizationStatus: "blocked",
      persistenceStatus: "disabled",
      automaticPersistenceEnabled: false,
      notice: RECOVERY_NOTICE,
    };
  }

  const shouldPersist = raw !== prepared.json;
  // Rewriting drops what this build cannot keep, such as attempts for lessons added later; copy the original first.
  if (shouldPersist && !backUpStoredPortfolio(storage, raw, false) && dropsAttempts(parsed, prepared.portfolio)) {
    return {
      portfolio: prepared.portfolio,
      source: "v2",
      normalizationStatus: prepared.normalizationStatus,
      persistenceStatus: "disabled",
      automaticPersistenceEnabled: false,
      notice: LOSSY_BLOCKED_NOTICE,
    };
  }
  const persistenceStatus = shouldPersist
    ? persistPrepared(storage, prepared.json)
    : "not-needed";
  return {
    portfolio: prepared.portfolio,
    source: "v2",
    normalizationStatus: prepared.normalizationStatus,
    persistenceStatus,
    automaticPersistenceEnabled: true,
    ...noticeFor(prepared.normalizationStatus, persistenceStatus),
  };
}

function loadMigrated(
  portfolio: LearningPortfolioV2,
  storage: StoragePort,
  curriculum: CurriculumLessonReader,
): PortfolioLoadResult {
  const prepared = preparePortfolio(portfolio, curriculum);
  if (!prepared.portfolio || !prepared.json || prepared.normalizationStatus === "blocked") {
    return {
      portfolio: prepared.portfolio ?? createPortfolio(curriculum),
      source: "legacy",
      normalizationStatus: prepared.normalizationStatus,
      persistenceStatus: "disabled",
      automaticPersistenceEnabled: false,
      notice: RECOVERY_NOTICE,
    };
  }
  const persistenceStatus = persistPrepared(storage, prepared.json);
  return {
    portfolio: prepared.portfolio,
    source: "legacy",
    normalizationStatus: prepared.normalizationStatus,
    persistenceStatus,
    automaticPersistenceEnabled: true,
    ...noticeFor(prepared.normalizationStatus, persistenceStatus),
  };
}

// shortcut: one backup slot; a newer unreadable value replaces an earlier copy, a lossy rewrite never does.
function backUpStoredPortfolio(storage: StoragePort, raw: string, replaceExisting: boolean): boolean {
  try {
    const existing = storage.getItem(portfolioBackupStorageKey);
    if (existing === raw) return true;
    if (existing !== null && !replaceExisting) return false;
    storage.setItem(portfolioBackupStorageKey, raw);
    // Read back: an adapter may ignore keys it does not own (the Pages demo storage does).
    return storage.getItem(portfolioBackupStorageKey) === raw;
  } catch {
    return false;
  }
}

// shortcut: compares attempt counts only; dropped trials inside an attempt still rewrite without a copy.
function dropsAttempts(parsed: unknown, prepared: LearningPortfolioV2): boolean {
  const attempts = typeof parsed === "object" && parsed !== null ? (parsed as { attempts?: unknown }).attempts : undefined;
  return typeof attempts === "object" && attempts !== null
    && Object.keys(attempts).length > Object.keys(prepared.attempts).length;
}

function withUnreadableNotice(loaded: PortfolioLoadResult): PortfolioLoadResult {
  return { ...loaded, notice: loaded.notice ? `${UNREADABLE_NOTICE} ${loaded.notice}` : UNREADABLE_NOTICE };
}

function persistPrepared(storage: StoragePort, json: string): PortfolioPersistenceStatus {
  try {
    storage.setItem(portfolioStorageKey, json);
    return "saved";
  } catch {
    return "failed";
  }
}

function readStoredValue(storage: StoragePort, key: string): StoredValue {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return { status: "missing" };
    return utf8ByteLength(raw) > maximumRawPortfolioJsonBytes
      ? { status: "oversized" }
      : { status: "available", raw };
  } catch {
    return { status: "failed" };
  }
}

function unavailableLoad(curriculum: CurriculumLessonReader): PortfolioLoadResult {
  return {
    portfolio: createPortfolio(curriculum),
    source: "empty",
    normalizationStatus: "unchanged",
    persistenceStatus: "unavailable",
    automaticPersistenceEnabled: false,
    notice: STORAGE_UNAVAILABLE_NOTICE,
  };
}

function blockedLoad(curriculum: CurriculumLessonReader, notice = RECOVERY_NOTICE): PortfolioLoadResult {
  return {
    portfolio: createPortfolio(curriculum),
    source: "empty",
    normalizationStatus: "blocked",
    persistenceStatus: "disabled",
    automaticPersistenceEnabled: false,
    notice,
  };
}

function noticeFor(
  normalizationStatus: PortfolioNormalizationStatus,
  persistenceStatus: PortfolioPersistenceStatus,
): Readonly<{ notice?: string }> {
  if (persistenceStatus === "failed") return { notice: STORAGE_UNAVAILABLE_NOTICE };
  return normalizationStatus === "unchanged" ? {} : { notice: portfolioNormalizationNotice };
}
