import type { CurriculumRegistry } from "../../curriculum/registry";
import {
  legacyPortfolioStorageKey,
  portfolioStorageKey,
} from "../../learning/portfolio/constants";
import type { StoragePort } from "../../learning/portfolio/ports";
import { browserStorage } from "../portfolio/browserStorage";
import { createDemoPortfolio } from "./demoPortfolio";

export const demoPortfolioStorageKey = "musicaMathematica.demo.learning.v2";

/**
 * Gives the hosted demo its own persistent namespace and a deterministic seed.
 * The ordinary portfolio and legacy migration key are never exposed.
 */
export function createDemoStorage(
  curriculum: CurriculumRegistry,
  backing: StoragePort | undefined = browserStorage(),
): StoragePort {
  const memory = new Map<string, string>();
  const seed = JSON.stringify(createDemoPortfolio(curriculum));

  return {
    getItem(key) {
      if (key === legacyPortfolioStorageKey) return null;
      if (key !== portfolioStorageKey) return null;
      return read(backing, demoPortfolioStorageKey) ?? memory.get(demoPortfolioStorageKey) ?? seed;
    },
    setItem(key, value) {
      if (key !== portfolioStorageKey) return;
      memory.set(demoPortfolioStorageKey, value);
      write(backing, demoPortfolioStorageKey, value);
    },
    removeItem(key) {
      if (key !== portfolioStorageKey && key !== legacyPortfolioStorageKey) return;
      memory.delete(demoPortfolioStorageKey);
      remove(backing, demoPortfolioStorageKey);
    },
  };
}

function read(storage: StoragePort | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(storage: StoragePort | undefined, key: string, value: string): void {
  if (!storage) throw new Error("Demo storage backing is unavailable.");
  storage.setItem(key, value);
}

function remove(storage: StoragePort | undefined, key: string): void {
  if (!storage) throw new Error("Demo storage backing is unavailable.");
  storage.removeItem(key);
}
