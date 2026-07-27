import { describe, expect, it } from "vitest";
import { isDeterministicTrialSource } from "./types";

describe("trial source reproducibility", () => {
  it("marks only computed and generated fixtures as deterministic", () => {
    expect(isDeterministicTrialSource("model")).toBe(true);
    expect(isDeterministicTrialSource("synthetic")).toBe(true);
    expect(isDeterministicTrialSource("microphone")).toBe(false);
    expect(isDeterministicTrialSource("file")).toBe(false);
  });
});
