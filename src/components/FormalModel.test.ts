import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormalModel, kuramotoLatex } from "./FormalModel";

describe("formal model", () => {
  it("exports the delayed Kuramoto model as LaTeX", () => {
    expect(kuramotoLatex).toContain("\\frac{d\\theta_i}{dt}");
    expect(kuramotoLatex).toContain("\\theta_j(t-\\tau_{ij})");
    expect(kuramotoLatex).toContain("K_{ij}");
  });

  it("renders the visible model with KaTeX instead of raw LaTeX code", () => {
    const html = renderToStaticMarkup(createElement(FormalModel));

    expect(html).toContain("katex");
    expect(html).not.toContain("<code>");
  });
});
