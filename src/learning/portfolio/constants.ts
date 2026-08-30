export const portfolioStorageKey = "musicaMathematica.learning.v2";
export const legacyPortfolioStorageKey = "ensembleCouplingLab.learning.v1";
export const maximumTrialsPerLesson = 12;
export const maximumTracePointsPerTrial = 256;
export const legacyLessonMapping = Object.freeze({ "lock-in": "lock-in-and-order", latency: "delay-jitter-topology", "low-latency-route": "delay-jitter-topology", "diagnose-instability": "delay-jitter-topology", click: "external-pulse-or-peer-adaptation", "click-or-peer-coupling": "external-pulse-or-peer-adaptation", "compose-with-latency": "external-pulse-or-peer-adaptation" } as const);
export type MigratedEnsembleLessonId = (typeof legacyLessonMapping)[keyof typeof legacyLessonMapping];
export const attemptKey = (labId: string, lessonId: string): string => `${labId}:${lessonId}`;
