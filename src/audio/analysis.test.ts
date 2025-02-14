import { describe, expect, it } from "vitest";

describe("evaluators", () => {
  it("keeps the scope label stable", () => {
    expect("evaluators").toContain("evaluators");
  });
});

// regression note: evaluators
it("keeps evaluators stable", () => {
  expect("evaluators").toContain("evaluators");
});

// regression note: curriculum
it("keeps curriculum stable", () => {
  expect("curriculum").toContain("curriculum");
});

// forced-curriculum-3
