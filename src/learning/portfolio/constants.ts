import { allLessons } from "../../labs/catalog";
import type { LabId } from "../../labs/types";

export const portfolioStorageKey = "musicaMathematica.learning.v2";
export const maximumTrialsPerLesson = 12;
export const maximumTracePointsPerTrial = 256;
export const portfolioLessonCount = allLessons.length;

export type MigratedEnsembleLessonId =
  | "lock-in-and-order"
  | "delay-jitter-topology"
  | "external-pulse-or-peer-adaptation";

export const legacyLessonMapping: Readonly<Record<string, MigratedEnsembleLessonId>> = {
  "lock-in": "lock-in-and-order",
  latency: "delay-jitter-topology",
  "low-latency-route": "delay-jitter-topology",
  "diagnose-instability": "delay-jitter-topology",
  click: "external-pulse-or-peer-adaptation",
  "click-or-peer-coupling": "external-pulse-or-peer-adaptation",
  "compose-with-latency": "external-pulse-or-peer-adaptation",
};

export const legacyScenarioLessonIds = Object.freeze({ ...legacyLessonMapping });

export function attemptKey(labId: LabId, lessonId: string): string {
  return `${labId}:${lessonId}`;
}
