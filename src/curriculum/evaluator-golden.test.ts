import { describe, expect, it } from "vitest";
import { curriculumRegistry } from "./catalog";
import { defaultFactorsFor, type FactorValue, type LessonDefinition } from "./contracts";
// Static import: a missing fixture fails collection instead of being silently regenerated.
import committedGolden from "./__golden__/evaluations.json";

const roundSignificant = (value: number): number | string => (
  Number.isFinite(value) ? Number(value.toPrecision(10)) : String(value)
);

function round(value: unknown): unknown {
  if (typeof value === "number") return roundSignificant(value);
  if (Array.isArray(value)) return value.map(round);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, round(entry)]));
  }
  return value;
}

function variantFactorsFor(lesson: LessonDefinition): Record<string, FactorValue> {
  return Object.fromEntries(lesson.factors.map((factor) => {
    if (factor.kind === "number") return [factor.id, factor.max];
    if (factor.kind === "select") return [factor.id, factor.options.at(-1)?.value ?? factor.defaultValue];
    return [factor.id, !factor.defaultValue];
  }));
}

function characterize(lesson: LessonDefinition, factors: Record<string, FactorValue>): unknown {
  try {
    return round(curriculumRegistry.evaluatorFor(lesson.domainId, lesson.id)(factors));
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

const RELATIVE_TOLERANCE = 1e-6;
const ABSOLUTE_TOLERANCE = 1e-9;

/**
 * Structural equality with a numeric tolerance. Math implementations differ in
 * their final floating-point bits across platforms (see e24d45e), and the
 * ensemble simulation accumulates those differences, so exact equality is not
 * portable. Returns the first differing path, or undefined when equal.
 */
function firstDifference(actual: unknown, expected: unknown, path: string): string | undefined {
  if (typeof actual === "number" && typeof expected === "number") {
    const scale = Math.max(Math.abs(actual), Math.abs(expected));
    return Math.abs(actual - expected) <= Math.max(ABSOLUTE_TOLERANCE, RELATIVE_TOLERANCE * scale)
      ? undefined
      : `${path}: ${actual} != ${expected}`;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return `${path}: length ${actual.length} != ${expected.length}`;
    for (let index = 0; index < actual.length; index += 1) {
      const difference = firstDifference(actual[index], expected[index], `${path}[${index}]`);
      if (difference) return difference;
    }
    return undefined;
  }
  if (typeof actual === "object" && actual !== null && typeof expected === "object" && expected !== null
    && !Array.isArray(actual) && !Array.isArray(expected)) {
    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);
    if (actualKeys.join() !== expectedKeys.join()) return `${path}: keys ${actualKeys.join()} != ${expectedKeys.join()}`;
    for (const key of actualKeys) {
      const difference = firstDifference(
        (actual as Record<string, unknown>)[key],
        (expected as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
      if (difference) return difference;
    }
    return undefined;
  }
  return Object.is(actual, expected) ? undefined : `${path}: ${String(actual)} != ${String(expected)}`;
}

describe("evaluator golden outputs", () => {
  it("pins every lesson evaluation at default and extreme factors", () => {
    const golden: Record<string, unknown> = {};
    for (const lesson of curriculumRegistry.catalog.flatMap((domain) => domain.lessons)) {
      golden[`${lesson.domainId}/${lesson.id}/default`] = characterize(lesson, defaultFactorsFor(lesson));
      golden[`${lesson.domainId}/${lesson.id}/variant`] = characterize(lesson, variantFactorsFor(lesson));
    }

    // An intentional model change regenerates the fixture from the new output;
    // review that diff as a behavior change, never as test maintenance.
    expect(firstDifference(golden, committedGolden, "golden")).toBeUndefined();
  });
});
