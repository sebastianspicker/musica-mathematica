import { describe, expect, it } from "vitest";
import type { EnsembleConfig, EnsembleMetrics } from "../simulation/ensemble";
import {
  createLessonAttempt,
  isLessonAttemptV1,
  transitionLessonAttempt,
  type LessonAttemptTransition,
  type RunSnapshot,
} from "./lessonAttempt";

const config: EnsembleConfig = {
  musicianCount: 4,
  tempoBpm: 100,
  tempoSpreadBpm: 3,
  couplingStrength: 1,
  latencySeconds: 0.01,
  jitterSeconds: 0,
  topology: "all-to-all",
  repertoireTexture: "pulse",
  clickTrackStrength: 0,
};

const metrics: EnsembleMetrics = {
  coherence: 0.8,
  phaseSpread: 0.1,
  phaseSpreadEquivalentMs: 5,
  leaderToFollowerPhaseLagMs: null,
  sectionCoherences: null,
  peerCouplingShare: 1,
  modelLatencyBudgetSeconds: 0.1,
};

function run(id: string): RunSnapshot {
  return { id, durationSeconds: 10, config, metrics };
}

function invalidExperimentAttempt(unsafeRun: unknown) {
  return {
    ...createLessonAttempt("lock-in"),
    stage: "experiment" as const,
    prediction: "Test coupling.",
    runs: [unsafeRun],
  };
}

function successfulTransition(transition: LessonAttemptTransition): Extract<LessonAttemptTransition, { ok: true }> {
  expect(transition.ok).toBe(true);
  if (!transition.ok) throw new Error(transition.reason);
  return transition;
}

describe("lesson attempt transitions", () => {
  it("requires a recorded prediction before experiment", () => {
    const attempt = createLessonAttempt("lock-in");
    const result = transitionLessonAttempt(attempt, { type: "advance", stage: "predict" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(transitionLessonAttempt(result.attempt, { type: "advance", stage: "experiment" })).toMatchObject({
      ok: false,
      reason: "Record a prediction before beginning an experiment.",
    });
  });

  it("locks the prediction once the experiment begins", () => {
    const predicted = transitionLessonAttempt(createLessonAttempt("lock-in"), {
      type: "set-prediction",
      prediction: "Coupling will reduce phase spread.",
    });
    if (!predicted.ok) throw new Error(predicted.reason);
    const experiment = transitionLessonAttempt(predicted.attempt, { type: "advance", stage: "experiment" });
    if (!experiment.ok) throw new Error(experiment.reason);

    expect(transitionLessonAttempt(experiment.attempt, {
      type: "set-prediction",
      prediction: "I changed my mind after seeing the model.",
    })).toMatchObject({
      ok: false,
      reason: "Predictions cannot change after the experiment begins.",
    });
  });

  it("requires two runs before comparison and explanation", () => {
    const predicted = transitionLessonAttempt(createLessonAttempt("latency"), {
      type: "set-prediction",
      prediction: "A slower tempo will help.",
    });
    expect(predicted.ok).toBe(true);
    if (!predicted.ok) return;
    const started = transitionLessonAttempt(predicted.attempt, { type: "advance", stage: "experiment" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const oneRun = transitionLessonAttempt(started.attempt, { type: "record-run", run: run("one") });
    expect(oneRun.ok).toBe(true);
    if (!oneRun.ok) return;

    expect(transitionLessonAttempt(oneRun.attempt, { type: "advance", stage: "compare" })).toMatchObject({
      ok: false,
      reason: "Record at least two runs before comparing or explaining.",
    });
  });

  it("advances through a valid two-run inquiry with required reflective responses", () => {
    const initial = createLessonAttempt("diagnose-instability");
    const prediction = transitionLessonAttempt(initial, {
      type: "set-prediction",
      prediction: "Jitter is the largest stressor.",
    });
    const experiment = successfulTransition(prediction).attempt;
    const first = successfulTransition(transitionLessonAttempt(experiment, { type: "advance", stage: "experiment" })).attempt;
    const second = successfulTransition(transitionLessonAttempt(first, { type: "record-run", run: run("first") })).attempt;
    const comparison = successfulTransition(transitionLessonAttempt(second, { type: "record-run", run: run("second") })).attempt;
    const explain = successfulTransition(transitionLessonAttempt(comparison, { type: "advance", stage: "compare" })).attempt;
    const performPrompt = successfulTransition(transitionLessonAttempt(explain, { type: "advance", stage: "explain" })).attempt;
    expect(transitionLessonAttempt(performPrompt, { type: "advance", stage: "perform" })).toMatchObject({
      ok: false,
      reason: "Record an explanation before performing.",
    });
    const explained = successfulTransition(transitionLessonAttempt(performPrompt, {
      type: "set-response",
      field: "explanation",
      response: "The second run reduced the modeled stressor.",
    })).attempt;
    const perform = successfulTransition(transitionLessonAttempt(explained, { type: "advance", stage: "perform" })).attempt;
    const reflected = successfulTransition(transitionLessonAttempt(perform, {
      type: "set-response",
      field: "performanceReflection",
      response: "The duo could hear the difference.",
    })).attempt;
    const transfer = successfulTransition(transitionLessonAttempt(reflected, { type: "advance", stage: "transfer" })).attempt;
    const transferred = successfulTransition(transitionLessonAttempt(transfer, {
      type: "set-response",
      field: "transferResponse",
      response: "Use a slower response pattern in the next rehearsal.",
    })).attempt;
    const debrief = transitionLessonAttempt(transferred, { type: "advance", stage: "debrief" });

    expect(debrief).toMatchObject({ ok: true, attempt: { stage: "debrief", runs: [{ id: "first" }, { id: "second" }] } });
    expect(initial.runs).toEqual([]);
  });

  it("rejects saved attempts whose config or stage invariants could crash the app", () => {
    expect(isLessonAttemptV1(invalidExperimentAttempt({
      ...run("unsafe"),
      config: { ...config, topology: "invented" },
    }))).toBe(false);

    expect(isLessonAttemptV1({
      ...createLessonAttempt("lock-in"),
      stage: "debrief",
      prediction: "Test coupling.",
      runs: [run("one"), run("two")],
    })).toBe(false);

    expect(isLessonAttemptV1(invalidExperimentAttempt({
      ...run("unsafe"),
      config: { ...config, tempoBpm: 999 },
    }))).toBe(false);

    expect(isLessonAttemptV1(invalidExperimentAttempt({
      ...run("unsafe"),
      metrics: { ...metrics, coherence: 1.5 },
    }))).toBe(false);
  });
});
