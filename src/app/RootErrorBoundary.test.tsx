import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { portfolioBackupStorageKey, portfolioStorageKey } from "../learning/portfolio/schema";
import { RootErrorBoundary } from "./RootErrorBoundary";

function memoryStorage(entries: Record<string, string>) {
  const values = new Map(Object.entries(entries));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function failedBoundary(props: ConstructorParameters<typeof RootErrorBoundary>[0]) {
  const boundary = new RootErrorBoundary(props);
  boundary.state = RootErrorBoundary.getDerivedStateFromError();
  return boundary;
}

describe("root error boundary", () => {
  it("offers download and clear without touching saved data", () => {
    const storage = memoryStorage({ [portfolioStorageKey]: "{\"version\":2}" });
    const markup = renderToStaticMarkup(<>{failedBoundary({ children: null, storage }).render()}</>);

    expect(markup).toContain("could not start");
    expect(markup).toContain("Download saved data");
    expect(markup).toContain("Clear local work and reload");
    expect(storage.values.get(portfolioStorageKey)).toBe("{\"version\":2}");
  });

  it("clears only after confirmation", () => {
    const storage = memoryStorage({ [portfolioStorageKey]: "{}", [portfolioBackupStorageKey]: "{}" });
    const reload = vi.fn();

    failedBoundary({ children: null, storage, confirmClear: () => false, reload }).clearAndReload();
    expect(storage.values.size).toBe(2);
    expect(reload).not.toHaveBeenCalled();

    failedBoundary({ children: null, storage, confirmClear: () => true, reload }).clearAndReload();
    expect(storage.values.size).toBe(0);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("offers no storage actions in demo mode", () => {
    const markup = renderToStaticMarkup(<>{failedBoundary({ children: null, storage: undefined }).render()}</>);
    expect(markup).not.toContain("<button");
  });
});
