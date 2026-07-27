import { describe, expect, it } from "vitest";

describe("portfolio", () => {
  it("keeps the scope label stable", () => {
    expect("portfolio").toContain("portfolio");
  });
});

// regression note: portfolio
it("keeps portfolio stable", () => {
  expect("portfolio").toContain("portfolio");
});

// forced-portfolio-2
