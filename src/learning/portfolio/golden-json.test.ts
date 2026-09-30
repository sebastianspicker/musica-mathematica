import { expect, it } from "vitest";
import {
  advanceAttempt,
  createAttemptV2,
  createPortfolio,
  recordTrial,
  selectLesson,
  setAttemptPrediction,
  updateAttempt,
} from "./aggregate";
import { exportPortfolioJson } from "./repository";
import type { TrialSnapshotV2 } from "./schema-v2";
import { testCurriculum } from "./testReader";

function trial(id: string, bpm: number, overrides: Partial<TrialSnapshotV2>): TrialSnapshotV2 {
  return {
    id,
    labId: "phase-proportion",
    lessonId: "from-bpm-to-period",
    protocolId: "phase-proportion.from-bpm-to-period.v1",
    deterministic: true,
    recordedAt: "2026-08-28T10:03:00.000Z",
    factors: { bpm, beatsPerBar: 4 },
    observables: [{ id: "period", label: "Period", value: 60 / bpm, unit: "s", aggregation: "instantaneous", claimId: "math.identity", precision: 3 }],
    trace: [{ x: bpm, y: 60 / bpm, series: "Seconds per beat" }],
    provenance: { source: "model", calibration: "uncalibrated", method: "test" },
    ...overrides,
  };
}

it("pins the exact persisted JSON of an attempt with two recorded trials", () => {
  const selected = selectLesson(testCurriculum, createPortfolio(testCurriculum), "phase-proportion", "from-bpm-to-period", "2026-08-28T10:00:00.000Z");
  const attempt = createAttemptV2(testCurriculum, "phase-proportion", "from-bpm-to-period", "2026-08-28T10:00:00.000Z");
  const predicted = setAttemptPrediction(attempt, "The period halves.", "2026-08-28T10:01:00.000Z");
  const experiment = advanceAttempt(predicted, "experiment", "2026-08-28T10:02:00.000Z");
  const first = recordTrial(testCurriculum, experiment, trial("Run A", 120, { seed: "seed-1", note: "First run." }), "2026-08-28T10:03:00.000Z");
  const second = recordTrial(testCurriculum, first, trial("Run B", 60, {
    recordedAt: "2026-08-28T10:04:00.000Z",
    provenance: { source: "file", calibration: "uncalibrated", method: "onset-flux", sampleRateHz: 44100, frameSize: 2048, hopSize: 1024, droppedFrames: 0 },
  }), "2026-08-28T10:04:00.000Z");
  const portfolio = updateAttempt(testCurriculum, selected, second);

  expect(exportPortfolioJson(portfolio, testCurriculum)).toBe(EXPECTED);
});

const EXPECTED = '{"version":2,"active":{"labId":"phase-proportion","lessonId":"from-bpm-to-period"},"attempts":{"phase-proportion:from-bpm-to-period":{"version":2,"labId":"phase-proportion","lessonId":"from-bpm-to-period","stage":"experiment","prediction":"The period halves.","trials":[{"id":"Run A","labId":"phase-proportion","lessonId":"from-bpm-to-period","protocolId":"phase-proportion.from-bpm-to-period.v1","deterministic":true,"seed":"seed-1","recordedAt":"2026-08-28T10:03:00.000Z","factors":{"bpm":120,"beatsPerBar":4},"observables":[{"id":"period","label":"Period","value":0.5,"unit":"s","aggregation":"instantaneous","claimId":"math.identity","precision":3}],"trace":[{"x":120,"y":0.5,"series":"Seconds per beat"}],"provenance":{"source":"model","calibration":"uncalibrated","method":"test"},"note":"First run."},{"id":"Run B","labId":"phase-proportion","lessonId":"from-bpm-to-period","protocolId":"phase-proportion.from-bpm-to-period.v1","deterministic":true,"recordedAt":"2026-08-28T10:04:00.000Z","factors":{"bpm":60,"beatsPerBar":4},"observables":[{"id":"period","label":"Period","value":1,"unit":"s","aggregation":"instantaneous","claimId":"math.identity","precision":3}],"trace":[{"x":60,"y":1,"series":"Seconds per beat"}],"provenance":{"source":"file","calibration":"uncalibrated","method":"onset-flux","sampleRateHz":44100,"frameSize":2048,"hopSize":1024,"droppedFrames":0}}],"updatedAt":"2026-08-28T10:04:00.000Z"}}}';
