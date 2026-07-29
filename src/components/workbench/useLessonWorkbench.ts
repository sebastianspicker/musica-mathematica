import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { evaluateLesson } from "../../labs/evaluate";
import { defaultFactorsFor, isDeterministicTrialSource, type FactorValue, type InputMode, type LabLesson, type TrialSnapshotV2 } from "../../labs/types";
import { activeAttempt, advanceAttempt, createPortfolio, recordTrial, selectLesson, setAttemptPrediction, setAttemptResponse, type LessonAttemptV2 } from "../../learning/portfolio";
import { assessTrialComparison } from "../../learning/trialComparison";
import { lessonStages } from "../../learning/lessonAttempt";
import { usePulseAudio } from "../usePulseAudio";
import {
  factorsForAttempt,
  initialMotionEnabled,
  recordingBlocker,
  runLabel,
  seedForTrial,
} from "./workbenchHelpers";

export type LessonWorkbenchRuntime = Readonly<{
  audio: ReturnType<typeof usePulseAudio>;
  audioEvaluation: ReturnType<typeof evaluateLesson> | null;
  comparison: ReturnType<typeof assessTrialComparison>;
  evaluation: ReturnType<typeof evaluateLesson>;
  experimentActive: boolean;
  factors: Record<string, FactorValue>;
  inputMode: InputMode;
  message: string | null;
  motionEnabled: boolean;
  note: string;
  playhead: number;
  running: boolean;
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
  setAudioEvaluation: Dispatch<SetStateAction<ReturnType<typeof evaluateLesson> | null>>;
  setMotionEnabled: Dispatch<SetStateAction<boolean>>;
  setNote: Dispatch<SetStateAction<string>>;
  stepPlayback: () => void;
  togglePlayback: () => void;
  updateFactor: (factorId: string, value: FactorValue) => void;
}>;

type LessonWorkbenchDependencies = Readonly<{
  lesson: LabLesson;
  attempt: LessonAttemptV2;
  onAttemptChange: (attempt: LessonAttemptV2) => void;
  onPersistenceMessage: (message: string | null) => void;
}>;

export function useLessonWorkbench(dependencies: LessonWorkbenchDependencies): LessonWorkbenchRuntime {
  const state = useLessonWorkbenchState(dependencies.lesson, dependencies.attempt);
  const audio = usePulseAudio();
  const playback = usePlayback(dependencies.lesson.protocol.durationSeconds, audio.triggerPulse);
  const actions = useInquiryActions({ ...dependencies, ...state, ...playback });
  return { ...state, ...playback, audio, ...actions };
}

function useLessonWorkbenchState(lesson: LabLesson, attempt: LessonAttemptV2) {
  const [factors, setFactors] = useState<Record<string, FactorValue>>(() => factorsForAttempt(lesson, attempt));
  const [inputMode, setInputMode] = useState<InputMode>("synthetic");
  const [audioEvaluation, setAudioEvaluation] = useState<ReturnType<typeof evaluateLesson> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [motionEnabled, setMotionEnabled] = useState(initialMotionEnabled);
  const syntheticEvaluation = useMemo(() => evaluateLesson(lesson, factors), [factors, lesson]);
  const evaluation = inputMode === "synthetic" ? syntheticEvaluation : audioEvaluation ?? syntheticEvaluation;
  const comparison = useMemo(() => assessTrialComparison(lesson, attempt.trials), [attempt.trials, lesson]);
  const experimentActive = lessonStages.indexOf(attempt.stage) >= lessonStages.indexOf("experiment");
  return { audioEvaluation, comparison, evaluation, experimentActive, factors, inputMode, message, motionEnabled, note, setAudioEvaluation, setFactors, setInputMode, setMessage, setMotionEnabled, setNote };
}

function usePlayback(duration: number, triggerPulse: ReturnType<typeof usePulseAudio>["triggerPulse"]) {
  const [running, setRunning] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const previousBeatRef = useRef(-1);
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number): void => {
      const elapsed = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      setPlayhead((current) => advancePlayhead(current, elapsed, duration, previousBeatRef, triggerPulse, setRunning));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [duration, running, triggerPulse]);
  return { playhead, running, setPlayhead, setRunning };
}

type InquiryActionContext = ReturnType<typeof useLessonWorkbenchState> & ReturnType<typeof usePlayback> & LessonWorkbenchDependencies;

function useInquiryActions(context: InquiryActionContext) {
  return {
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
  };
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
  const next = recordTrial(context.attempt, trial);
  if (next === context.attempt) {
    context.setMessage("The run could not be recorded. Check the inquiry stage and result provenance.");
    return;
  }
  context.onAttemptChange(next);
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
  context.onAttemptChange(activeAttempt(selectLesson(createPortfolio(), context.lesson.labId, context.lesson.id)));
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
  if (context.playhead >= context.lesson.protocol.durationSeconds) context.setPlayhead(0);
  context.setRunning((value) => !value);
}

function updateFactor(context: InquiryActionContext, factorId: string, value: FactorValue): void {
  context.setFactors((current) => ({ ...current, [factorId]: value }));
  if (context.inputMode !== "synthetic") {
    context.setAudioEvaluation(null);
    context.setMessage("A factor changed. Analyze a fresh bounded audio segment before recording another run.");
  }
}

function advancePlayhead(current: number, elapsed: number, duration: number, previousBeatRef: { current: number }, triggerPulse: ReturnType<typeof usePulseAudio>["triggerPulse"], setRunning: Dispatch<SetStateAction<boolean>>): number {
  const next = current + elapsed;
  const beat = Math.floor(next);
  if (beat !== previousBeatRef.current) {
    previousBeatRef.current = beat;
    triggerPulse(beat % 4, beat % 4 === 0 ? 1 : 0.65);
  }
  if (next >= duration) {
    setRunning(false);
    return duration;
  }
  return next;
}

function createTrial(lesson: LabLesson, attempt: LessonAttemptV2, factors: Record<string, FactorValue>, evaluation: ReturnType<typeof evaluateLesson>, note: string): TrialSnapshotV2 {
  const deterministic = isDeterministicTrialSource(evaluation.provenance.source) && lesson.protocol.deterministic;
  return { id: runLabel(attempt.trials.length), labId: lesson.labId, lessonId: lesson.id, protocolId: lesson.protocol.id, deterministic, ...(deterministic && lesson.protocol.seed ? { seed: seedForTrial(lesson, factors) } : {}), recordedAt: new Date().toISOString(), factors: { ...factors }, observables: evaluation.observables.map((item) => ({ ...item })), trace: evaluation.trace.map((point) => ({ ...point })), provenance: { ...evaluation.provenance }, ...(note.trim() ? { note: note.trim() } : {}) };
}
