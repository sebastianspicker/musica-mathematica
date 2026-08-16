import { describe, expect, it } from "vitest";
import type { TracePoint, TrialSnapshotV2 } from "../labs/types";
import { defaultConfig, lessonPresets } from "../simulation/presets";
import { simulateEnsemble } from "../simulation/ensemble";
import {
  createLessonAttempt,
  transitionLessonAttempt,
  type LessonAttemptV1,
  type LessonStage,
} from "./lessonAttempt";
import {
  advanceAttempt,
  clearPortfolio,
  createAttemptV2,
  createPortfolio,
  exportPortfolioJson,
  loadPortfolio,
  maximumTracePointsPerTrial,
  migrateLessonAttemptV1,
  portfolioLessonCount,
  portfolioStorageKey,
  recordTrial,
  savePortfolio,
  selectLesson,
  updateAttempt,
} from "./portfolio";
import type { LessonAttemptV2 } from "./portfolio";
import { learningRecordStorageKey } from "./localLearningRecord";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function phaseProportionTrial(id: string, trace: readonly TracePoint[] = []): TrialSnapshotV2 {
  return {
    id,
    labId: "phase-proportion",
    lessonId: "from-bpm-to-period",
    protocolId: "phase-proportion.from-bpm-to-period.v1",
    deterministic: true,
    recordedAt: "2026-07-17T10:01:00.000Z",
    factors: { bpm: 120, beatsPerBar: 4 },
    observables: [{ id: "period", label: "Period", value: 0.5, unit: "s", aggregation: "instantaneous", claimId: "math.identity" }],
    trace,
    provenance: { source: "model", calibration: "uncalibrated", method: "test" },
  };
}

function expectLaterTimestampedUpdate(
  attempt: LessonAttemptV2,
  now: string,
  update: () => LessonAttemptV2,
): LessonAttemptV2 {
  expect(attempt.updatedAt < now).toBe(true);
  const updated = update();
  expect({ isNew: updated !== attempt, updatedAt: updated.updatedAt }).toEqual({
    isNew: true,
    updatedAt: now,
  });
  return updated;
}

function expectAdvanced(
  attempt: LessonAttemptV2,
  stage: LessonStage,
  now: string,
): LessonAttemptV2 {
  const advanced = expectLaterTimestampedUpdate(
    attempt,
    now,
    () => advanceAttempt(attempt, stage, now),
  );
  expect(advanced).toEqual({ ...attempt, stage, updatedAt: now });
  return advanced;
}

function expectRecordedTrial(
  attempt: LessonAttemptV2,
  trial: TrialSnapshotV2,
  now: string,
): LessonAttemptV2 {
  const attemptSnapshot = structuredClone(attempt);
  const trialSnapshot = structuredClone(trial);
  const recorded = expectLaterTimestampedUpdate(
    attempt,
    now,
    () => recordTrial(attempt, trial, now),
  );
  expect({
    attempt,
    originalTrialCount: attempt.trials.length,
    originalTrials: attempt.trials,
    trial,
  }).toEqual({
    attempt: attemptSnapshot,
    originalTrialCount: attemptSnapshot.trials.length,
    originalTrials: attemptSnapshot.trials,
    trial: trialSnapshot,
  });
  expect({
    appendedTrial: recorded.trials.at(-1),
    hasNewTrials: recorded.trials !== attempt.trials,
    trialCount: recorded.trials.length,
  }).toEqual({
    appendedTrial: trialSnapshot,
    hasNewTrials: true,
    trialCount: attemptSnapshot.trials.length + 1,
  });
  return recorded;
}

describe("v2 learning portfolio", () => {
  it("advances through each gated stage only after its immediate prerequisite", () => {
    const transitionTimes = Array.from(
      { length: 10 },
      (_, minute) => `2026-07-17T10:${String(minute).padStart(2, "0")}:00.000Z`,
    );
    const [orientAt, predictAt, experimentAt, firstTrialAt, secondTrialAt, compareAt, explainAt, performAt, transferAt, debriefAt] = transitionTimes;
    const orient = createAttemptV2("phase-proportion", "from-bpm-to-period", orientAt);
    expect(advanceAttempt(orient, "experiment", predictAt)).toBe(orient);

    const predict = expectAdvanced(orient, "predict", predictAt);
    expect(advanceAttempt(predict, "experiment", experimentAt)).toBe(predict);

    const experiment = expectAdvanced(
      { ...predict, prediction: "The period halves." },
      "experiment",
      experimentAt,
    );
    const oneTrial = expectRecordedTrial(experiment, phaseProportionTrial("Run A"), firstTrialAt);
    expect(advanceAttempt(oneTrial, "compare", compareAt)).toBe(oneTrial);

    const twoTrials = expectRecordedTrial(oneTrial, phaseProportionTrial("Run B"), secondTrialAt);
    const compare = expectAdvanced(twoTrials, "compare", compareAt);
    const underRecordedComparison = { ...compare, trials: [phaseProportionTrial("Run A")] };
    expect(advanceAttempt(underRecordedComparison, "explain", explainAt)).toBe(underRecordedComparison);

    const explain = expectAdvanced(compare, "explain", explainAt);
    expect(advanceAttempt(explain, "perform", performAt)).toBe(explain);

    const perform = expectAdvanced({ ...explain, explanation: "The period is inversely proportional to tempo." }, "perform", performAt);
    expect(advanceAttempt(perform, "transfer", transferAt)).toBe(perform);

    const transfer = expectAdvanced({ ...perform, performanceReflection: "I kept the pulse steady." }, "transfer", transferAt);
    expect(advanceAttempt(transfer, "debrief", debriefAt)).toBe(transfer);

    expectAdvanced({ ...transfer, transferResponse: "I can use this relationship when setting a tempo." }, "debrief", debriefAt);
  });

  it("covers all curated lessons and caps stored trace data", () => {
    expect(portfolioLessonCount).toBe(24);
    const attempt = { ...createAttemptV2("phase-proportion", "from-bpm-to-period", "2026-07-17T10:00:00.000Z"), stage: "experiment" as const, prediction: "The period halves." };
    const trace = Array.from({ length: 1000 }, (_, index) => ({ x: index, y: index / 1000, series: "test" }));
    const recorded = recordTrial(attempt, phaseProportionTrial("Run A", trace), "2026-07-17T10:01:00.000Z");
    expect(recorded.trials[0].trace).toHaveLength(maximumTracePointsPerTrial);
    expect(recorded.trials[0].trace.at(0)?.x).toBe(0);
    expect(recorded.trials[0].trace.at(-1)?.x).toBe(999);
  });

  it("migrates a valid v1 ensemble attempt without deleting the legacy record", () => {
    const trial = simulateEnsemble(defaultConfig, 1);
    let legacy = createLessonAttempt("latency");
    legacy = transitionLessonAttempt(legacy, { type: "set-prediction", prediction: "Lower tempo will change the model budget." }).attempt;
    legacy = transitionLessonAttempt(legacy, { type: "advance", stage: "experiment" }).attempt;
    legacy = transitionLessonAttempt(legacy, { type: "record-run", run: { id: "Run 1", durationSeconds: 1, config: defaultConfig, metrics: trial.finalMetrics, note: "legacy note" } }).attempt;
    const storage = new MemoryStorage();
    storage.setItem(learningRecordStorageKey, JSON.stringify(legacy));

    const portfolio = loadPortfolio(storage, "2026-07-17T10:00:00.000Z");

    expect(portfolio.active).toEqual({ labId: "ensemble-dynamics", lessonId: "delay-jitter-topology" });
    const migratedAttempt = Object.values(portfolio.attempts)[0];
    expect(migratedAttempt.trials[0].note).toBe("legacy note");
    expect(migratedAttempt.trials[0].factors).toEqual({
      latencyMs: defaultConfig.latencySeconds * 1000,
      jitterMs: defaultConfig.jitterSeconds * 1000,
      couplingStrength: defaultConfig.couplingStrength,
      topology: defaultConfig.topology,
    });
    expect(storage.getItem(learningRecordStorageKey)).not.toBeNull();
    expect(storage.getItem(portfolioStorageKey)).not.toBeNull();
  });

  it("serializes only normalized records and clear removes v1 and v2", () => {
    const storage = new MemoryStorage();
    let portfolio = selectLesson(createPortfolio(), "phase-proportion", "from-bpm-to-period", "2026-07-17T10:00:00.000Z");
    const attempt = createAttemptV2("phase-proportion", "from-bpm-to-period", "2026-07-17T10:00:00.000Z");
    portfolio = updateAttempt(portfolio, attempt);
    expect(savePortfolio(portfolio, storage)).toBe(true);
    const exported = exportPortfolioJson(portfolio);
    expect(exported).not.toContain("rawPcm");
    expect(exported).not.toContain("deviceId");
    expect(exported).not.toContain("fileName");
    storage.setItem(learningRecordStorageKey, "legacy");
    expect(clearPortfolio(storage)).toBe(true);
    expect(storage.getItem(portfolioStorageKey)).toBeNull();
    expect(storage.getItem(learningRecordStorageKey)).toBeNull();
  });

  it.each([
    {
      caseName: "an out-of-range display precision",
      factors: { bpm: 120, beatsPerBar: 4 },
      precision: 101,
    },
    {
      caseName: "a factor value that does not match the lesson definition",
      factors: { bpm: "fast", beatsPerBar: 4 },
      precision: 1,
    },
  ])("ignores stored portfolios containing $caseName", ({ factors, precision }) => {
    const storage = new MemoryStorage();
    storage.setItem(portfolioStorageKey, JSON.stringify({
      version: 2,
      active: { labId: "phase-proportion", lessonId: "from-bpm-to-period" },
      attempts: {
        "phase-proportion:from-bpm-to-period": {
          version: 2,
          labId: "phase-proportion",
          lessonId: "from-bpm-to-period",
          stage: "experiment",
          prediction: "The period halves.",
          updatedAt: "2026-07-17T10:01:00.000Z",
          trials: [{
            ...phaseProportionTrial("Run A"),
            factors,
            observables: [{
              id: "period",
              label: "Period",
              value: 0.5,
              unit: "s",
              aggregation: "instantaneous",
              claimId: "math.identity",
              precision,
            }],
          }],
        },
      },
    }));

    expect(loadPortfolio(storage, "2026-07-17T10:02:00.000Z")).toEqual(createPortfolio());
  });

  it.each([
    ["lock-in", "lock-in-and-order", { musicianCount: 8, tempoBpm: 104, tempoSpreadBpm: 12, couplingStrength: 0.18 }],
    ["latency", "delay-jitter-topology", { latencyMs: 75, jitterMs: 0, couplingStrength: 1.6, topology: "leader-follower" }],
    ["low-latency-route", "delay-jitter-topology", { latencyMs: 7.5, jitterMs: 2, couplingStrength: 1.25, topology: "all-to-all" }],
    ["diagnose-instability", "delay-jitter-topology", { latencyMs: 55, jitterMs: 26, couplingStrength: 0.55, topology: "leader-follower" }],
    ["click", "external-pulse-or-peer-adaptation", { clickTrackStrength: 2.1, couplingStrength: 0.25, tempoSpreadBpm: 10, tempoBpm: 116 }],
    ["click-or-peer-coupling", "external-pulse-or-peer-adaptation", { clickTrackStrength: 2.4, couplingStrength: 0.3, tempoSpreadBpm: 12, tempoBpm: 118 }],
    ["compose-with-latency", "external-pulse-or-peer-adaptation", { clickTrackStrength: 0, couplingStrength: 0.9, tempoSpreadBpm: 5, tempoBpm: 72 }],
  ])("projects legacy lesson %s into the current lesson factor contract", (legacyLessonId, lessonId, expectedFactors) => {
    const preset = lessonPresets.find((candidate) => candidate.id === legacyLessonId);
    if (!preset) throw new Error(`Missing legacy preset ${legacyLessonId}.`);
    const migrated = migrateLessonAttemptV1(
      legacyAttemptWithRun(legacyLessonId, preset.config),
      "2026-07-17T10:00:00.000Z",
    );

    expect(migrated.active.lessonId).toBe(lessonId);
    expect(Object.values(migrated.attempts)[0].trials[0].factors).toEqual(expectedFactors);
    expect(savePortfolio(migrated, new MemoryStorage())).toBe(true);
  });
});

function legacyAttemptWithRun(
  lessonId: string,
  config: typeof defaultConfig,
): LessonAttemptV1 {
  const simulation = simulateEnsemble(config, 1);
  let attempt = createLessonAttempt(lessonId);
  attempt = transitionLessonAttempt(attempt, { type: "set-prediction", prediction: "Legacy prediction." }).attempt;
  attempt = transitionLessonAttempt(attempt, { type: "advance", stage: "experiment" }).attempt;
  return transitionLessonAttempt(attempt, {
    type: "record-run",
    run: {
      id: "Legacy run",
      durationSeconds: 1,
      config,
      metrics: simulation.finalMetrics,
    },
  }).attempt;
}
