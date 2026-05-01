import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../simulation/presets";
import { Controls } from "./Controls";

describe("Controls", () => {
  it("renders control variables as KaTeX symbols", () => {
    const html = renderToStaticMarkup(
      createElement(Controls, {
        config: defaultConfig,
        onChange: () => undefined,
      }),
    );

    expect(html).toContain("katex");
    expect(html).toContain("ω");
    expect(html).toContain("Δ");
    expect(html).toContain("τ");
    expect(html).not.toContain("\\bar");
    expect(html).not.toContain("\\omega");
    expect(html).not.toContain("\\mathrm");
    expect(html).not.toContain("\\mathcal");
    expect(html).not.toContain("katex-error");
  });
});
