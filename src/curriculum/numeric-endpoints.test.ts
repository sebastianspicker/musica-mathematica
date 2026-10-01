import { describe, expect, it } from "vitest";
import { curriculumRegistry } from "./catalog";
import { defaultFactorsFor, type FactorValue } from "./contracts";

const endpointCases = curriculumRegistry.catalog.flatMap((domain) =>
  domain.lessons.flatMap((lesson) =>
    lesson.factors.flatMap((factor) => {
      if (factor.kind !== "number") return [];
      return (["min", "max"] as const).map((endpoint) => ({
        domainId: domain.id,
        lesson,
        factor,
        endpoint,
      }));
    }),
  ),
);

describe("advertised numeric lesson endpoints", () => {
  it("covers both endpoints of every numeric lesson control", () => {
    expect(endpointCases).toHaveLength(140);
  });

  it.each(endpointCases)(
    "$domainId/$lesson.id accepts $factor.id=$endpoint",
    ({ domainId, lesson, factor, endpoint }) => {
      const factors: Record<string, FactorValue> = {
        ...defaultFactorsFor(lesson),
        [factor.id]: factor[endpoint],
      };

      expect(() => curriculumRegistry.evaluatorFor(domainId, lesson.id)(factors)).not.toThrow();
    },
    30_000,
  );
});
