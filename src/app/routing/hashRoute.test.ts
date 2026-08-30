import { describe, expect, it } from "vitest";
import { curriculumRegistry } from "../../curriculum/catalog";
import { lessonByRoute, lessonRoute } from "./hashRoute";

describe("hash routes", () => {
  it("serializes and resolves a curriculum lesson", () => {
    const route = lessonRoute(curriculumRegistry.defaultLesson);
    expect(route).toBe(`#/labs/${curriculumRegistry.defaultLesson.domainId}/lessons/${curriculumRegistry.defaultLesson.id}`);
    expect(lessonByRoute(route, curriculumRegistry)).toBe(curriculumRegistry.defaultLesson);
  });

  it("rejects incomplete, unknown, and extra-segment routes", () => {
    expect(lessonByRoute("#/labs/phase-proportion", curriculumRegistry)).toBeUndefined();
    expect(lessonByRoute("#/labs/missing/lessons/missing", curriculumRegistry)).toBeUndefined();
    expect(lessonByRoute("#/labs/phase-proportion/lessons/x/extra", curriculumRegistry)).toBeUndefined();
  });
});
