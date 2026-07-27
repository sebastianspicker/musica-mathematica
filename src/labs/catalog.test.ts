import { describe, expect, it } from "vitest";
import { claims } from "../learning/evidence";
import { sourceById } from "../learning/sources";
import { allLessons, labCatalog, labLessonById, lessonByRoute } from "./catalog";
import { evaluateLesson } from "./evaluate";
import { defaultFactorsFor, lessonRoute } from "./types";

describe("Musica Mathematica curriculum contract", () => {
  it("publishes eight domains with three unique routed lessons each", () => {
    expect(labCatalog).toHaveLength(8);
    expect(labCatalog.map((domain) => domain.id)).toEqual([
      "phase-proportion",
      "ensemble-dynamics",
      "rhythm-meter",
      "pitch-tuning",
      "harmony-geometry",
      "timbre-acoustics",
      "probability-form",
      "measurement-inference",
    ]);
    expect(allLessons).toHaveLength(24);
    expect(new Set(allLessons.map((lesson) => lesson.id)).size).toBe(24);
    for (const domain of labCatalog) {
      expect(domain.lessons).toHaveLength(3);
      expect(domain.lessons.map((lesson) => lesson.level)).toEqual(["foundation", "model", "critique"]);
      for (const lesson of domain.lessons) {
        expect(lessonByRoute(lessonRoute(lesson))).toBe(lesson);
        expect(labLessonById(domain.id, lesson.id)).toBe(lesson);
      }
    }
  });

  it("keeps factor defaults inside their published domains", () => {
    for (const lesson of allLessons) {
      for (const factor of lesson.factors) {
        if (factor.kind === "number") {
          expect(factor.defaultValue).toBeGreaterThanOrEqual(factor.min);
          expect(factor.defaultValue).toBeLessThanOrEqual(factor.max);
          expect(factor.step).toBeGreaterThan(0);
        } else if (factor.kind === "select") {
          expect(factor.options.some((option) => option.value === factor.defaultValue)).toBe(true);
        }
      }
    }
  });

  it("evaluates every default lesson deterministically with traceable finite outputs", () => {
    const knownClaimIds = new Set(claims.map((claim) => claim.id));
    const missingVisibleClaims: string[] = [];
    for (const lesson of allLessons) {
      const factors = defaultFactorsFor(lesson);
      expect(evaluateLesson(lesson, factors)).toEqual(evaluateLesson(lesson, factors));
      const evaluation = evaluateLesson(lesson, factors);
      expect(evaluation.headline.length).toBeGreaterThan(0);
      expect(evaluation.provenance.calibration).toBe("uncalibrated");
      expect(evaluation.traceAxes.x.label.length).toBeGreaterThan(0);
      expect(evaluation.traceAxes.y.label.length).toBeGreaterThan(0);
      expect(evaluation.trace.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
      for (const observable of evaluation.observables) {
        expect(knownClaimIds.has(observable.claimId)).toBe(true);
        if (!lesson.claimIds.includes(observable.claimId)) {
          missingVisibleClaims.push(`${lesson.id}:${observable.claimId}`);
        }
        if (typeof observable.value === "number") expect(Number.isFinite(observable.value)).toBe(true);
      }
      for (const claimId of lesson.claimIds) expect(knownClaimIds.has(claimId)).toBe(true);
      for (const sourceId of lesson.sourceIds) expect(sourceById(sourceId)).toBeDefined();
    }
    expect(missingVisibleClaims).toEqual([]);
  });

  it("offers microphone and file only in lessons that label outputs as hypotheses or observations", () => {
    const audioLessons = allLessons.filter((lesson) => lesson.inputModes.length > 1);
    expect(audioLessons.map((lesson) => lesson.id)).toEqual([
      "recorded-onset-hypotheses",
      "chord-hypotheses",
      "time-varying-timbre",
    ]);
    for (const lesson of audioLessons) {
      expect(lesson.claimIds.some((id) => id === "measurement.local" || id === "hypothesis.transcription")).toBe(true);
    }
  });
});
