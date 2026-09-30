import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadPortfolioJson, portfolioDownloadFilename, portfolioDownloadMimeType } from "./download";

describe("portfolio download", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pins the filename and MIME type", () => {
    expect(portfolioDownloadFilename).toBe("musica-mathematica-portfolio.json");
    expect(portfolioDownloadMimeType).toBe("application/json");
  });

  it("clicks a download anchor for the blob URL and revokes it", () => {
    const events: string[] = [];
    const link = { href: "", download: "", click: vi.fn(() => { events.push(`click:${link.href}`); }) };
    const blobs: { parts: unknown[]; options: unknown }[] = [];
    class FakeBlob {
      constructor(parts: unknown[], options: unknown) { blobs.push({ parts, options }); }
    }
    const createObjectURL = vi.fn(() => "blob:portfolio");
    const revokeObjectURL = vi.fn((url: string) => { events.push(`revoke:${url}`); });
    const createElement = vi.fn(() => link);
    vi.stubGlobal("document", { createElement });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("Blob", FakeBlob);

    downloadPortfolioJson("{\"version\":2}");

    expect(blobs).toEqual([{ parts: ["{\"version\":2}"], options: { type: "application/json" } }]);
    expect(createElement).toHaveBeenCalledWith("a");
    expect(link.download).toBe("musica-mathematica-portfolio.json");
    expect(link.href).toBe("blob:portfolio");
    expect(events).toEqual(["click:blob:portfolio", "revoke:blob:portfolio"]);
  });
});
