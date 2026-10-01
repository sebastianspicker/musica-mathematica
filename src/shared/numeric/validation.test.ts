import { describe, expect, it } from "vitest";
import { assertFinite, assertNonEmptyFiniteNumbers, assertSafeInteger } from "./validation";

describe("numeric validation", () => {
  it("names the argument and requirement in every message", () => {
    expect(() => assertFinite("phase", Number.NaN)).toThrow("phase must be finite");
    expect(() => assertFinite("phase", 0.5)).not.toThrow();
    expect(() => assertSafeInteger("count", 1.5)).toThrow("count must be a safe integer");
    expect(() => assertSafeInteger("count", 2 ** 60)).toThrow("count must be a safe integer");
    expect(() => assertSafeInteger("count", -3)).not.toThrow();
  });

  it("takes the name first when checking non-empty finite arrays", () => {
    expect(() => assertNonEmptyFiniteNumbers("samples", [])).toThrow("samples must not be empty");
    expect(() => assertNonEmptyFiniteNumbers("samples", [1, Infinity])).toThrow("samples must contain only finite numbers");
    expect(() => assertNonEmptyFiniteNumbers("samples", [1, 2])).not.toThrow();
  });
});
