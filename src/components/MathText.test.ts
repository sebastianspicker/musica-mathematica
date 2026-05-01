import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MathText } from "./MathText";

describe("MathText", () => {
  it("renders inline math through KaTeX", () => {
    const html = renderToStaticMarkup(
      createElement(MathText, {
        label: "theta i",
        latex: "\\theta_i",
      }),
    );

    expect(html).toContain("katex");
    expect(html).toContain("theta i");
    expect(html).not.toContain("katex-mathml");
  });

  it("renders display math through KaTeX", () => {
    const html = renderToStaticMarkup(
      createElement(MathText, {
        display: true,
        label: "coherence r of t",
        latex: "r(t)",
      }),
    );

    expect(html).toContain("math-display");
    expect(html).toContain("katex-display");
  });

  it("does not render trusted-link payloads from LaTeX", () => {
    const html = renderToStaticMarkup(
      createElement(MathText, {
        label: "blocked href payload",
        latex: "\\href{javascript:alert(1)}{x}",
      }),
    );

    expect(html).not.toContain("href=");
    expect(html).not.toContain("javascript:");
  });

  it("does not render trusted-html class payloads from LaTeX", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const html = renderToStaticMarkup(
        createElement(MathText, {
          label: "blocked html class payload",
          latex: "\\htmlClass{unsafe-class}{x}",
        }),
      );

      expect(html).not.toContain("unsafe-class");
    } finally {
      warn.mockRestore();
    }
  });

  it("does not render trusted-image payloads from LaTeX", () => {
    const html = renderToStaticMarkup(
      createElement(MathText, {
        label: "blocked image payload",
        latex: "\\includegraphics{https://example.invalid/pixel.png}",
      }),
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("example.invalid");
  });
});
