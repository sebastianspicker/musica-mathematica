import { describe, expect, it } from "vitest";
import { defaultFactorsFor, isEvaluationOutput } from "../curriculum/contracts";
import { curriculumCatalog, evaluatorFor } from "../curriculum/catalog";

describe("domain curriculum catalog", () => {
  it("composes exactly eight domains with three lessons each and unique protocols", () => {
    expect(curriculumCatalog).toHaveLength(8);
    expect(curriculumCatalog.flatMap((domain) => domain.lessons)).toHaveLength(24);
    expect(curriculumCatalog.every((domain) => domain.lessons.length === 3)).toBe(true);

    const protocolIds = curriculumCatalog.flatMap((domain) => domain.lessons.map((lesson) => lesson.protocol.id));
    expect(new Set(protocolIds).size).toBe(protocolIds.length);
  });

  it("has valid defaults that produce finite evaluation output", () => {
    for (const domain of curriculumCatalog) {
      for (const lesson of domain.lessons) {
        const factors = defaultFactorsFor(lesson);
        const evaluation = evaluatorFor(domain.id, lesson.id)(factors);
        expect(isEvaluationOutput(evaluation)).toBe(true);
        expect(evaluation.trace.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
        expect(evaluation.observables.every((observable) =>
          typeof observable.value !== "number" || Number.isFinite(observable.value),
        )).toBe(true);
      }
    }
  });

  it("preserves the unregistered-lesson error", () => {
    expect(() => evaluatorFor("phase-proportion", "missing")).toThrowError(
      new RangeError("No evaluator is registered for lesson missing."),
    );
  });
});
