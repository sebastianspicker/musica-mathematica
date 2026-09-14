import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { defaultFactorsFor, type EvaluationOutput, type FactorValue, type InputMode, type LessonDefinition } from "../../curriculum/contracts";
import type { CurriculumRegistry } from "../../curriculum/registry";
import { activeAttempt, advanceAttempt, createPortfolio, recordTrial, selectLesson, setAttemptPrediction, setAttemptResponse } from "../../learning/portfolio/aggregate";
import { assessTrialComparison } from "../../learning/inquiry/comparison";
import { lessonStages } from "../../learning/stages";
import type { LessonAttemptV2, TrialSnapshotV2 } from "../../learning/portfolio/schema-v2";
import { createPlaybackStore, type PlaybackStore } from "./playbackStore";
import { usePulseAudio } from "../audio/usePulseAudio";
import {
  factorsForAttempt,
  initialMotionEnabled,
  recordingBlocker,
  recordedRunWasTrimmed,
  runLabel,
  seedForTrial,
} from "./workbenchHelpers";

export type LessonControllerRuntime = Readonly<{
  audio: ReturnType<typeof usePulseAudio>;
  audioEvaluation: EvaluationOutput | null;
  comparison: ReturnType<typeof assessTrialComparison>;
  evaluation: EvaluationOutput;
  experimentActive: boolean;
  factors: Record<string, FactorValue>;
  inputMode: InputMode;
  message: string | null;
  motionEnabled: boolean;
  note: string;
  playback: PlaybackStore;
  recordLabel: string;
  beginPrediction: () => void;
  changeInputMode: (mode: InputMode) => void;
  openComparison: () => void;
  openInterpretation: () => void;
  recordCurrentRun: () => void;
  resetPlayback: () => void;
  restartLesson: () => void;
  savePrediction: (event: FormEvent<HTMLFormElement>) => void;
  saveResponse: (
    event: FormEvent<HTMLFormElement>,
    field: "explanation" | "performanceReflection" | "transferResponse",
    nextStage: "perform" | "transfer" | "debrief",
  ) => void;
  setAudioEvaluation: Dispatch<SetStateAction<EvaluationOutput | null>>;
  setMotionEnabled: Dispatch<SetStateAction<boolean>>;
  setNote: Dispatch<SetStateAction<string>>;
  stepPlayback: () => void;
  togglePlayback: () => void;
  updateFactor: (factorId: string, value: FactorValue) => void;
}>;

export type LessonControllerDependencies = Readonly<{
  curriculum: CurriculumRegistry;
  lesson: LessonDefinition;
  attempt: LessonAttemptV2;
  initialFactors?: Readonly<Record<string, FactorValue>>;
  onAttemptChange: (attempt: LessonAttemptV2) => void;
  onPersistenceMessage: (message: string | null) => void;
}>;

export function useLessonController(dependencies: LessonControllerDependencies): LessonControllerRuntime {
  const state = useLessonControllerState(
    dependencies.curriculum,
    dependencies.lesson,
    dependencies.attempt,
    dependencies.initialFactors,
  );
  const audio = usePulseAudio();
  const playback = usePlayback(dependencies.lesson.protocol.durationSeconds, audio.triggerPulse);
  const { curriculum, lesson, attempt, onAttemptChange, onPersistenceMessage } = dependencies;
  const context = useMemo(() => ({ curriculum, lesson, attempt, onAttemptChange, onPersistenceMessage, ...state, ...playback }), [curriculum, lesson, attempt, onAttemptChange, onPersistenceMessage, state, playback]);
  const actions = useInquiryActions(context);
  return { ...state, playback, audio, ...actions };
}

function useLessonControllerState(
  curriculum: CurriculumRegistry,
  lesson: LessonDefinition,
  attempt: LessonAttemptV2,
  initialFactors?: Readonly<Record<string, FactorValue>>,
) {
  const [factors, setFactors] = useState<Record<string, FactorValue>>(
    () => factorsForAttempt(lesson, attempt, initialFactors),
  );
  const [inputMode, setInputMode] = useState<InputMode>("synthetic");
  const [audioEvaluation, setAudioEvaluation] = useState<EvaluationOutput | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [motionEnabled, setMotionEnabled] = useState(initialMotionEnabled);
  const syntheticEvaluation = useMemo(() => evaluateLesson(curriculum, lesson, factors), [curriculum, factors, lesson]);
  const evaluation = inputMode === "synthetic" ? syntheticEvaluation : audioEvaluation ?? syntheticEvaluation;
  const comparison = useMemo(() => assessTrialComparison(lesson, attempt.trials), [attempt.trials, lesson]);
  const experimentActive = lessonStages.indexOf(attempt.stage) >= lessonStages.indexOf("experiment");
  const recordLabel = runLabel(attempt.trials.length);
  return useMemo(() => ({ audioEvaluation, comparison, evaluation, experimentActive, factors, inputMode, message, motionEnabled, note, recordLabel, setAudioEvaluation, setFactors, setInputMode, setMessage, setMotionEnabled, setNote }), [audioEvaluation, comparison, evaluation, experimentActive, factors, inputMode, message, motionEnabled, note, recordLabel]);
}

function usePlayback(duration: number, triggerPulse: ReturnType<typeof usePulseAudio>["triggerPulse"]) {
  const [playback] = useState(() => createPlaybackStore(duration, {
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frame) => cancelAnimationFrame(frame),
  }));
  useEffect(() => { playback.setPulse(triggerPulse); }, [playback, triggerPulse]);
  useEffect(() => playback.stop, [playback]);
  return playback;
}

type InquiryActionContext = ReturnType<typeof useLessonControllerState> & ReturnType<typeof usePlayback> & LessonControllerDependencies;

function useInquiryActions(context: InquiryActionContext) {
  return useMemo(() => ({
    beginPrediction: () => { beginPrediction(context); },
    changeInputMode: (mode: InputMode) => { changeInputMode(context, mode); },
    openComparison: () => { openComparison(context); },
    openInterpretation: () => { openInterpretation(context); },
    recordCurrentRun: () => { recordCurrentRun(context); },
    resetPlayback: () => { resetPlayback(context); },
    restartLesson: () => { restartLesson(context); },
    savePrediction: (event: FormEvent<HTMLFormElement>) => { savePrediction(context, event); },
    saveResponse: (event: FormEvent<HTMLFormElement>, field: "explanation" | "performanceReflection" | "transferResponse", nextStage: "perform" | "transfer" | "debrief") => { saveResponse(context, event, field, nextStage); },
    stepPlayback: () => { stepPlayback(context); },
    togglePlayback: () => { togglePlayback(context); },
    updateFactor: (factorId: string, value: FactorValue) => { updateFactor(context, factorId, value); },
  }), [context]);
}

function beginPrediction(context: InquiryActionContext): void {
  const next = advanceAttempt(context.attempt, "predict");
  if (next === context.attempt) return;
  context.onAttemptChange(next);
  context.setMessage("Write a directional prediction before changing the factors.");
}

function changeInputMode(context: InquiryActionContext, mode: InputMode): void {
  context.setInputMode(mode);
  context.setAudioEvaluation(null);
}

function openComparison(context: InquiryActionContext): void {
  if (!context.comparison.valid) {
    context.setMessage(context.comparison.reason);
    return;
  }
  context.onAttemptChange(advanceAttempt(context.attempt, "compare"));
  context.setMessage(context.comparison.reason);
}

function openInterpretation(context: InquiryActionContext): void {
  context.onAttemptChange(advanceAttempt(context.attempt, "explain"));
  context.setMessage("Explain the mechanism and state the inference boundary.");
}

function recordCurrentRun(context: InquiryActionContext): void {
  const blocked = recordingBlocker(context.attempt, context.inputMode, context.audioEvaluation, context.lesson);
  if (blocked) {
    context.setMessage(blocked);
    return;
  }
  const trial = createTrial(context.lesson, context.attempt, context.factors, context.evaluation, context.note);
  const next = recordTrial(context.curriculum, context.attempt, trial);
  if (next === context.attempt) {
    context.setMessage("The run could not be recorded. Check the inquiry stage and result provenance.");
    return;
  }
  context.onAttemptChange(next);
  if (recordedRunWasTrimmed(context.attempt, trial, next)) {
    context.onPersistenceMessage("This run was saved within local portfolio limits. Older runs, long notes, or detailed result data were trimmed.");
  }
  context.setNote("");
  context.setRunning(false);
  context.setPlayhead(context.lesson.protocol.durationSeconds);
  context.setMessage(`${trial.id} recorded locally. ${next.trials.length === 1 ? "Change one factor before Run B." : assessTrialComparison(context.lesson, next.trials).reason}`);
}

function resetPlayback(context: InquiryActionContext): void {
  context.setRunning(false);
  context.setPlayhead(0);
}

function restartLesson(context: InquiryActionContext): void {
  if (!window.confirm("Restart this lesson attempt? Other lesson attempts remain in the local portfolio.")) return;
  context.onAttemptChange(activeAttempt(context.curriculum, selectLesson(context.curriculum, createPortfolio(context.curriculum), context.lesson.domainId, context.lesson.id)));
  context.setFactors(defaultFactorsFor(context.lesson));
  context.setInputMode("synthetic");
  context.setAudioEvaluation(null);
  context.setNote("");
  context.setMessage(null);
  resetPlayback(context);
  context.onPersistenceMessage("This lesson attempt was restarted; other portfolio lessons were preserved.");
}

function savePrediction(context: InquiryActionContext, event: FormEvent<HTMLFormElement>): void {
  event.preventDefault();
  const prediction = String(new FormData(event.currentTarget).get("prediction") ?? "");
  const next = advanceAttempt(setAttemptPrediction(context.attempt, prediction), "experiment");
  if (next.stage !== "experiment") {
    context.setMessage("Write a prediction before beginning the experiment.");
    return;
  }
  context.onAttemptChange(next);
  context.setMessage("Experiment unlocked. Record a baseline, change one factor, then record Run B.");
}

function saveResponse(context: InquiryActionContext, event: FormEvent<HTMLFormElement>, field: "explanation" | "performanceReflection" | "transferResponse", nextStage: "perform" | "transfer" | "debrief"): void {
  event.preventDefault();
  const response = String(new FormData(event.currentTarget).get(field) ?? "");
  const next = advanceAttempt(setAttemptResponse(context.attempt, field, response), nextStage);
  if (next.stage !== nextStage) {
    context.setMessage("Write a response before continuing.");
    return;
  }
  context.onAttemptChange(next);
  context.setMessage(nextStage === "debrief" ? "Lesson inquiry complete. The result is not a score or grade." : "Response saved locally.");
}

function stepPlayback(context: InquiryActionContext): void {
  context.setPlayhead((value) => Math.min(context.lesson.protocol.durationSeconds, value + 0.5));
}

function togglePlayback(context: InquiryActionContext): void {
  if (context.getPlayhead() >= context.lesson.protocol.durationSeconds) context.setPlayhead(0);
  context.setRunning((value) => !value);
}

function updateFactor(context: InquiryActionContext, factorId: string, value: FactorValue): void {
  context.setFactors((current) => ({ ...current, [factorId]: value }));
  if (context.inputMode !== "synthetic") {
    context.setAudioEvaluation(null);
    context.setMessage("A factor changed. Analyze a fresh bounded audio segment before recording another run.");
  }
}


function createTrial(lesson: LessonDefinition, attempt: LessonAttemptV2, factors: Record<string, FactorValue>, evaluation: EvaluationOutput, note: string): TrialSnapshotV2 {
  const deterministic = (evaluation.provenance.source === "model" || evaluation.provenance.source === "synthetic") && lesson.protocol.deterministic;
  return { id: runLabel(attempt.trials.length), labId: lesson.domainId, lessonId: lesson.id, protocolId: lesson.protocol.id, deterministic, ...(deterministic && lesson.protocol.seed ? { seed: seedForTrial(lesson, factors) } : {}), recordedAt: new Date().toISOString(), factors: { ...factors }, observables: evaluation.observables.map((item) => ({ ...item })), trace: evaluation.trace.map((point) => ({ ...point })), provenance: { ...evaluation.provenance }, ...(note.trim() ? { note: note.trim() } : {}) };
}

function evaluateLesson(curriculum: CurriculumRegistry, lesson: LessonDefinition, factors: Readonly<Record<string, FactorValue>>): EvaluationOutput {
  return curriculum.evaluatorFor(lesson.domainId, lesson.id)(factors);
}
