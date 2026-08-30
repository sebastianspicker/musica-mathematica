import type { CurriculumLessonReader, LessonDefinition } from "../../curriculum/contracts";

const lessonRoutePattern = /^#\/labs\/([^/]+)\/lessons\/([^/]+)$/;

export function lessonRoute(lesson: Pick<LessonDefinition, "domainId" | "id">): string {
  return `#/labs/${lesson.domainId}/lessons/${lesson.id}`;
}

export function lessonByRoute(hash: string, curriculum: CurriculumLessonReader): LessonDefinition | undefined {
  const match = lessonRoutePattern.exec(hash);
  return match ? curriculum.lessonById(match[1], match[2]) : undefined;
}
