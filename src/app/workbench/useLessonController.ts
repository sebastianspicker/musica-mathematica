import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { defaultFactorsFor, type EvaluationOutput, type FactorValue, type InputMode, type LessonDefinition } from "../../curriculum/contracts";
import type { CurriculumRegistry } from "../../curriculum/registry";
import { advanceAttempt, createAttemptV2, createTrialSnapshot, recordedRunWasTrimmed, recordTrial, runLabel, setAttemptPrediction, setAttemptResponse } from "../../learning/portfolio/aggregate";
import { assessTrialComparison } from "../../learning/inquiry/comparison";
import { factorsForAttempt, recordingBlocker } from "../../learning/inquiry/recording";
import { lessonStages, type LessonResponseField } from "../../learning/stages";
import type { LessonAttemptV2 } from "../../learning/portfolio/schema";
import { createPlaybackStore, type PlaybackStore } from "./playbackStore";
import { usePulseAudio } from "../audio/usePulseAudio";
import type { InquiryMessage, LessonWorkbenchRuntimeView } from "../../ui/workbench/types";

export type LessonControllerRuntime = LessonWorkbenchRuntimeView & Readonly<{
  audio: ReturnType<typeof usePulseAudio>;
  audioEvaluation: EvaluationOutput | null;
  comparison: ReturnType<typeof assessTrialComparison>;
  playback: PlaybackStore;
  setAudioEvaluation: Dispatch<SetStateAction<EvaluationOutput | null>>;
  setMotionEnabled: Dispatch<SetStateAction<boolean>>;
  setNote: Dispatch<SetStateAction<string>>;
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
  const [message, setMessage] = useState<InquiryMessage | null>(null);
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
    saveResponse: (event: FormEvent<HTMLFormElement>, field: LessonResponseField, nextStage: "perform" | "transfer" | "debrief") => { saveResponse(context, event, field, nextStage); },
    stepPlayback: () => { stepPlayback(context); },
    togglePlayback: () => { togglePlayback(context); },
    updateFactor: (factorId: string, value: FactorValue) => { updateFactor(context, factorId, value); },
  }), [context]);
}

function beginPrediction(context: InquiryActionContext): void {
  const next = advanceAttempt(context.attempt, "predict");
  if (next === context.attempt) return;
  context.onAttemptChange(next);
  context.setMessage(notice("Write a directional prediction before changing the factors."));
}

function changeInputMode(context: InquiryActionContext, mode: InputMode): void {
  context.setInputMode(mode);
  context.setAudioEvaluation(null);
}

function openComparison(context: InquiryActionContext): void {
  if (!context.comparison.valid) {
    context.setMessage(notice(context.comparison.reason));
    return;
  }
  context.onAttemptChange(advanceAttempt(context.attempt, "compare"));
  context.setMessage(notice(context.comparison.reason));
}

function openInterpretation(context: InquiryActionContext): void {
  context.onAttemptChange(advanceAttempt(context.attempt, "explain"));
  context.setMessage(routine("Explain the mechanism and state the inference boundary."));
}

function recordCurrentRun(context: InquiryActionContext): void {
  const blocked = recordingBlocker(context.attempt, context.inputMode, context.audioEvaluation, context.lesson);
  if (blocked) {
    context.setMessage(notice(blocked));
    return;
  }
  const trial = createTrialSnapshot({
    lesson: context.lesson,
    runIndex: context.attempt.trials.length,
    factors: context.factors,
    evaluation: context.evaluation,
    note: context.note,
    recordedAt: new Date().toISOString(),
  });
  const next = recordTrial(context.curriculum, context.attempt, trial);
  if (next === context.attempt) {
    context.setMessage(notice("The run could not be recorded. Check the inquiry stage and result provenance."));
    return;
  }
  context.onAttemptChange(next);
  if (recordedRunWasTrimmed(context.attempt, trial, next)) {
    context.onPersistenceMessage("This run was saved within local portfolio limits. Older runs, long notes, or detailed result data were trimmed.");
  }
  context.setNote("");
  context.setRunning(false);
  context.setPlayhead(context.lesson.protocol.durationSeconds);
  const text = `${trial.id} recorded locally. ${next.trials.length === 1 ? "Change one factor before Run B." : assessTrialComparison(context.lesson, next.trials).reason}`;
  // Only the lettered baseline and comparison runs are routine; later runs stay visible.
  context.setMessage(context.attempt.trials.length < 2 ? routine(text) : notice(text));
}

function resetPlayback(context: InquiryActionContext): void {
  context.setRunning(false);
  context.setPlayhead(0);
}

function restartLesson(context: InquiryActionContext): void {
  if (!window.confirm("Restart this lesson attempt? Other lesson attempts remain in the local portfolio.")) return;
  context.onAttemptChange(createAttemptV2(context.curriculum, context.lesson.domainId, context.lesson.id));
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
    context.setMessage(notice("Write a prediction before beginning the experiment."));
    return;
  }
  context.onAttemptChange(next);
  context.setMessage(routine("Experiment unlocked. Record a baseline, change one factor, then record Run B."));
}

function saveResponse(context: InquiryActionContext, event: FormEvent<HTMLFormElement>, field: LessonResponseField, nextStage: "perform" | "transfer" | "debrief"): void {
  event.preventDefault();
  const response = String(new FormData(event.currentTarget).get(field) ?? "");
  const next = advanceAttempt(setAttemptResponse(context.attempt, field, response), nextStage);
  if (next.stage !== nextStage) {
    context.setMessage(notice("Write a response before continuing."));
    return;
  }
  context.onAttemptChange(next);
  context.setMessage(routine(nextStage === "debrief" ? "Lesson inquiry complete. The result is not a score or grade." : "Response saved locally."));
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
    context.setMessage(notice("A factor changed. Analyze a fresh bounded audio segment before recording another run."));
  }
}


function routine(text: string): InquiryMessage {
  return { text, routine: true };
}

function notice(text: string): InquiryMessage {
  return { text, routine: false };
}

function initialMotionEnabled(): boolean {
  return typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function evaluateLesson(curriculum: CurriculumRegistry, lesson: LessonDefinition, factors: Readonly<Record<string, FactorValue>>): EvaluationOutput {
  return curriculum.evaluatorFor(lesson.domainId, lesson.id)(factors);
}
