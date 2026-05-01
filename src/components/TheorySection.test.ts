import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TheorySection } from "./TheorySection";

describe("TheorySection", () => {
  it("renders inline theory variables as KaTeX symbols", () => {
    const html = renderToStaticMarkup(createElement(TheorySection));

    expect(html).toContain("katex");
    expect(html).toContain("θ");
    expect(html).toContain("ω");
    expect(html).toContain("→");
    expect(html).not.toContain("\\theta");
    expect(html).not.toContain("\\omega");
    expect(html).not.toContain("katex-error");
  });
});
