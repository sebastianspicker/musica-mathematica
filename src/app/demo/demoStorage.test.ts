import { describe, expect, it } from "vitest";
import { curriculumRegistry } from "../../curriculum/catalog";
import {
  legacyPortfolioStorageKey,
  portfolioStorageKey,
} from "../../learning/portfolio/constants";
import type { StoragePort } from "../../learning/portfolio/ports";
import {
  createDemoStorage,
  demoPortfolioStorageKey,
} from "./demoStorage";

describe("createDemoStorage", () => {
  it("seeds and persists only through the demo namespace", () => {
    const values = new Map<string, string>([
      [portfolioStorageKey, "ordinary portfolio"],
      [legacyPortfolioStorageKey, "legacy portfolio"],
    ]);
    const storage = createDemoStorage(curriculumRegistry, mapStorage(values));
    const seed = storage.getItem(portfolioStorageKey);

    expect(seed).toContain('"stage":"compare"');
    expect(storage.getItem(legacyPortfolioStorageKey)).toBeNull();
    storage.setItem(portfolioStorageKey, "updated demo");
    expect(values.get(demoPortfolioStorageKey)).toBe("updated demo");
    expect(values.get(portfolioStorageKey)).toBe("ordinary portfolio");
    expect(values.get(legacyPortfolioStorageKey)).toBe("legacy portfolio");
  });

  it("restores the deterministic seed after demo data is cleared", () => {
    const values = new Map<string, string>();
    const storage = createDemoStorage(curriculumRegistry, mapStorage(values));
    storage.setItem(portfolioStorageKey, "changed demo");
    storage.removeItem(portfolioStorageKey);

    expect(values.has(demoPortfolioStorageKey)).toBe(false);
    expect(storage.getItem(portfolioStorageKey)).toContain('"stage":"compare"');
  });

  it("reports backing write failures while keeping the demo readable in memory", () => {
    const storage = createDemoStorage(curriculumRegistry, {
      getItem: () => null,
      setItem: () => { throw new Error("quota"); },
      removeItem: () => { throw new Error("blocked"); },
    });

    expect(() => storage.setItem(portfolioStorageKey, "changed demo")).toThrow("quota");
    expect(storage.getItem(portfolioStorageKey)).toBe("changed demo");
    expect(() => storage.removeItem(portfolioStorageKey)).toThrow("blocked");
  });
});

function mapStorage(values: Map<string, string>): StoragePort {
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}
