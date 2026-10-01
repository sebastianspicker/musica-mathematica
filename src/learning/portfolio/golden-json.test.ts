import { expect, it } from "vitest";
import {
  advanceAttempt,
  createAttemptV2,
  createPortfolio,
  createTrialSnapshot,
  recordTrial,
  selectLesson,
  setAttemptPrediction,
  updateAttempt,
} from "./aggregate";
import { exportPortfolioJson } from "./repository";
import type { TrialSnapshotV2 } from "./schema";
import { testCurriculum } from "./curriculumFixture.test-helper";

const fixtureLesson = testCurriculum.lessonById("phase-proportion", "from-bpm-to-period");
if (!fixtureLesson) throw new Error("Missing fixture lesson.");
// A seeded protocol keeps the optional `seed` field in the pinned output.
const lesson = { ...fixtureLesson, protocol: { ...fixtureLesson.protocol, seed: "seed-1" } };

function trial(runIndex: number, bpm: number, note = ""): TrialSnapshotV2 {
  return createTrialSnapshot({
    lesson,
    runIndex,
    factors: { bpm, beatsPerBar: 4 },
    evaluation: {
      headline: "Synthetic result",
      result: String(60 / bpm),
      observables: [{ id: "period", label: "Period", value: 60 / bpm, unit: "s", aggregation: "instantaneous", claimId: "math.identity", precision: 3 }],
      trace: [{ x: bpm, y: 60 / bpm, series: "Seconds per beat" }],
      traceAxes: { x: { label: "Tempo", unit: "bpm" }, y: { label: "Period", unit: "s" } },
      visualKind: "measurement",
      annotation: "Synthetic test evaluation.",
      provenance: { source: "model", calibration: "uncalibrated", method: "test" },
    },
    note,
    recordedAt: runIndex === 0 ? "2026-08-28T10:03:00.000Z" : "2026-08-28T10:04:00.000Z",
  });
}

it("pins the exact persisted JSON of an attempt with two recorded trials", () => {
  const selected = selectLesson(testCurriculum, createPortfolio(testCurriculum), "phase-proportion", "from-bpm-to-period", "2026-08-28T10:00:00.000Z");
  const attempt = createAttemptV2(testCurriculum, "phase-proportion", "from-bpm-to-period", "2026-08-28T10:00:00.000Z");
  const predicted = setAttemptPrediction(attempt, "The period halves.", "2026-08-28T10:01:00.000Z");
  const experiment = advanceAttempt(predicted, "experiment", "2026-08-28T10:02:00.000Z");
  const first = recordTrial(testCurriculum, experiment, trial(0, 120, "First run."), "2026-08-28T10:03:00.000Z");
  const second = recordTrial(testCurriculum, first, trial(1, 60), "2026-08-28T10:04:00.000Z");
  const portfolio = updateAttempt(testCurriculum, selected, second);

  expect(exportPortfolioJson(portfolio, testCurriculum)).toBe(EXPECTED);
});

const EXPECTED = '{"version":2,"active":{"labId":"phase-proportion","lessonId":"from-bpm-to-period"},"attempts":{"phase-proportion:from-bpm-to-period":{"version":2,"labId":"phase-proportion","lessonId":"from-bpm-to-period","stage":"experiment","prediction":"The period halves.","trials":[{"id":"Run A","labId":"phase-proportion","lessonId":"from-bpm-to-period","protocolId":"phase-proportion.from-bpm-to-period.v1","deterministic":true,"seed":"seed-1","recordedAt":"2026-08-28T10:03:00.000Z","factors":{"bpm":120,"beatsPerBar":4},"observables":[{"id":"period","label":"Period","value":0.5,"unit":"s","aggregation":"instantaneous","claimId":"math.identity","precision":3}],"trace":[{"x":120,"y":0.5,"series":"Seconds per beat"}],"provenance":{"source":"model","calibration":"uncalibrated","method":"test"},"note":"First run."},{"id":"Run B","labId":"phase-proportion","lessonId":"from-bpm-to-period","protocolId":"phase-proportion.from-bpm-to-period.v1","deterministic":true,"seed":"seed-1","recordedAt":"2026-08-28T10:04:00.000Z","factors":{"bpm":60,"beatsPerBar":4},"observables":[{"id":"period","label":"Period","value":1,"unit":"s","aggregation":"instantaneous","claimId":"math.identity","precision":3}],"trace":[{"x":60,"y":1,"series":"Seconds per beat"}],"provenance":{"source":"model","calibration":"uncalibrated","method":"test"}}],"updatedAt":"2026-08-28T10:04:00.000Z"}}}';

// A lesson that accepts file input, so a recorded-audio trial is valid for it.
const audioLesson = { ...fixtureLesson, inputModes: ["synthetic", "file"] as const };
const audioCurriculum = {
  defaultLesson: audioLesson,
  lessonById: (domainId: string, lessonId: string) => (
    domainId === audioLesson.domainId && lessonId === audioLesson.id ? audioLesson : undefined
  ),
};

it("pins the persisted JSON of a recorded-audio trial with analysis settings", () => {
  const attempt = advanceAttempt(
    setAttemptPrediction(createAttemptV2(audioCurriculum, "phase-proportion", "from-bpm-to-period", "2026-08-28T11:00:00.000Z"), "Onsets align.", "2026-08-28T11:01:00.000Z"),
    "experiment",
    "2026-08-28T11:02:00.000Z",
  );
  const recorded = createTrialSnapshot({
    lesson: audioLesson,
    runIndex: 0,
    factors: { bpm: 90, beatsPerBar: 3 },
    evaluation: {
      headline: "Local audio observation",
      result: "40 frames",
      observables: [{ id: "tempo1", label: "Tempo candidate 1", value: "90.0 BPM · 0.80", unit: null, aggregation: "distribution", claimId: "hypothesis.transcription" }],
      trace: [{ x: 0.5, y: 0.25, series: "Spectral flux" }],
      traceAxes: { x: { label: "Time", unit: "s" }, y: { label: "Spectral flux", unit: null } },
      visualKind: "spectrum",
      annotation: "Synthetic test evaluation.",
      provenance: { source: "file", calibration: "uncalibrated", method: "onset-flux", sampleRateHz: 44100, frameSize: 2048, hopSize: 1024, droppedFrames: 0 },
    },
    note: "",
    recordedAt: "2026-08-28T11:03:00.000Z",
  });
  const withTrial = recordTrial(audioCurriculum, attempt, recorded, "2026-08-28T11:03:00.000Z");
  const portfolio = updateAttempt(audioCurriculum, selectLesson(audioCurriculum, createPortfolio(audioCurriculum), "phase-proportion", "from-bpm-to-period", "2026-08-28T11:00:00.000Z"), withTrial);

  expect(exportPortfolioJson(portfolio, audioCurriculum)).toBe(EXPECTED_AUDIO);
});

const EXPECTED_AUDIO = '{"version":2,"active":{"labId":"phase-proportion","lessonId":"from-bpm-to-period"},"attempts":{"phase-proportion:from-bpm-to-period":{"version":2,"labId":"phase-proportion","lessonId":"from-bpm-to-period","stage":"experiment","prediction":"Onsets align.","trials":[{"id":"Run A","labId":"phase-proportion","lessonId":"from-bpm-to-period","protocolId":"phase-proportion.from-bpm-to-period.v1","deterministic":false,"recordedAt":"2026-08-28T11:03:00.000Z","factors":{"bpm":90,"beatsPerBar":3},"observables":[{"id":"tempo1","label":"Tempo candidate 1","value":"90.0 BPM · 0.80","unit":null,"aggregation":"distribution","claimId":"hypothesis.transcription"}],"trace":[{"x":0.5,"y":0.25,"series":"Spectral flux"}],"provenance":{"source":"file","calibration":"uncalibrated","method":"onset-flux","sampleRateHz":44100,"frameSize":2048,"hopSize":1024,"droppedFrames":0}}],"updatedAt":"2026-08-28T11:03:00.000Z"}}}';
