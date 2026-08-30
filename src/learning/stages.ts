export const lessonStages = [
  "orient", "predict", "experiment", "compare", "explain", "perform", "transfer", "debrief",
] as const;

export type LessonStage = (typeof lessonStages)[number];
export type LessonResponseField = "explanation" | "performanceReflection" | "transferResponse";

export const isLessonStage = (value: unknown): value is LessonStage =>
  typeof value === "string" && (lessonStages as readonly string[]).includes(value);
