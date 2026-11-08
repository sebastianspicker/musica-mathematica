import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadPortfolioJson, portfolioDownloadFilename, portfolioDownloadMimeType } from "./download";

describe("portfolio download", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("pins the filename and MIME type", () => {
    expect(portfolioDownloadFilename).toBe("musica-mathematica-portfolio.json");
    expect(portfolioDownloadMimeType).toBe("application/json");
  });

  it("clicks an attached download anchor and revokes the blob URL afterwards", () => {
    const events: string[] = [];
    const link = {
      href: "",
      download: "",
      click: vi.fn(() => { events.push(`click:${link.href}`); }),
      remove: vi.fn(() => { events.push("remove"); }),
    };
    const blobs: { parts: unknown[]; options: unknown }[] = [];
    class FakeBlob {
      constructor(parts: unknown[], options: unknown) { blobs.push({ parts, options }); }
    }
    const createObjectURL = vi.fn(() => "blob:portfolio");
    const revokeObjectURL = vi.fn((url: string) => { events.push(`revoke:${url}`); });
    const createElement = vi.fn(() => link);
    const append = vi.fn(() => { events.push("append"); });
    vi.stubGlobal("document", { createElement, body: { append } });
    vi.useFakeTimers();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("Blob", FakeBlob);

    downloadPortfolioJson("{\"version\":2}");

    expect(blobs).toEqual([{ parts: ["{\"version\":2}"], options: { type: "application/json" } }]);
    expect(createElement).toHaveBeenCalledWith("a");
    expect(link.download).toBe("musica-mathematica-portfolio.json");
    expect(link.href).toBe("blob:portfolio");
    // Revoking in the same task can cancel the download in some browsers.
    expect(events).toEqual(["append", "click:blob:portfolio", "remove"]);
    vi.runAllTimers();
    expect(events).toEqual(["append", "click:blob:portfolio", "remove", "revoke:blob:portfolio"]);
  });
});
