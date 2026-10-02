import { expect, it } from "vitest";
import { curriculumRegistry } from "../curriculum/catalog";
import { typesetEquation } from "../ui/typesetEquation";
import { flattenEquation } from "../ui/typesetEquation.test-helper";

it("typesets every curriculum equation without leftover plain-text markup", () => {
  for (const domain of curriculumRegistry.catalog) {
    for (const lesson of domain.lessons) {
      const text = flattenEquation(typesetEquation(lesson.equation));
      expect(text, lesson.equation).not.toMatch(/(?<![_^])[_^](?!\{)|\b(sum|sqrt|theta|omega|sigma|tau|phi|delta|Delta|pi)\b|\+\/-/);
    }
  }
});
