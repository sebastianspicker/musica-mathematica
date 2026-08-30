import type { MutableRefObject } from "react";
import { startMicrophoneSession } from "../../audio/browser/capture";
import {
  captureProcessorModuleUrl,
  createSelectionAnalysisWorker,
  createStreamingAnalysisWorker,
} from "../../audio/browser/runtime";
import { AUDIO_ANALYSIS_LIMITS, type SafeMediaSettings } from "../../audio/analysis/contracts";
import { decodeAudioSelection } from "../../audio/browser/fileInput";
import { analyzeSelectionInWorker, createMicrophoneAnalysisPipeline } from "../../audio/browser/workerClient";
import {
  microphoneFrameToEvaluation,
  selectionToEvaluation,
  type AudioEvaluationSettings,
} from "./mapAudioEvaluation";
import type { EvaluationOutput } from "../../curriculum/contracts";

type AnalysisStateSetters = Readonly<{
  onAnalysis: (evaluation: EvaluationOutput | null) => void;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string) => void;
}>;

export type AnalysisRequestGate = Readonly<{
  isCurrent: () => boolean;
  registerCleanup: (cleanup: () => void) => void;
  clearCleanup: (cleanup: () => void) => void;
}>;

type MicrophoneAnalysisRequest = Readonly<{
  analysisSettings: AudioEvaluationSettings;
  durationSeconds: number;
  frameSize: 2048 | 4096;
  gate: AnalysisRequestGate;
  state: AnalysisStateSetters;
  setSettings: (settings: SafeMediaSettings | null) => void;
}>;

export async function startMicrophoneAnalysis(request: MicrophoneAnalysisRequest): Promise<void> {
  const { analysisSettings, durationSeconds, frameSize, gate, setSettings, state } = request;
  const { onAnalysis, setBusy, setStatus } = state;
  beginAnalysis(state, "Requesting a local microphone segment…");
  const context = createAudioContext();
  if (!context) {
    setBusy(false);
    setStatus("Microphone analysis is unavailable because Web Audio is not supported.");
    return;
  }
  const resources = createMicrophoneResources(context);
  const { cleanup } = resources;
  gate.registerCleanup(cleanup);
  try {
    const started = await prepareMicrophoneCapture({
      analysisSettings,
      context,
      durationSeconds,
      frameSize,
      gate,
      onAnalysis,
      resources,
      setSettings,
      setStatus,
    });
    if (!started) {
      cleanup();
      return;
    }
    resources.setTimer(window.setTimeout(
      () => {
        finishMicrophoneCapture({ cleanup, gate, setBusy, setStatus });
      },
      durationSeconds * 1000,
    ));
  } catch (error) {
    cleanup();
    gate.clearCleanup(cleanup);
    if (!gate.isCurrent()) return;
    setBusy(false);
    setStatus(error instanceof Error ? error.message : "Microphone analysis could not start.");
  }
}

type MicrophoneResources = Readonly<{
  cleanup: () => void;
  setPipeline: (pipeline: Awaited<ReturnType<typeof createMicrophoneAnalysisPipeline>>) => void;
  setSessionStop: (stop: () => void) => void;
  setTimer: (timer: number) => void;
}>;

function beginAnalysis(state: AnalysisStateSetters, status: string): void {
  state.setBusy(true);
  state.setStatus(status);
  state.onAnalysis(null);
}

function createAudioContext(): AudioContext | null {
  const AudioContextCtor = window.AudioContext;
  return AudioContextCtor ? new AudioContextCtor() : null;
}

function createMicrophoneResources(context: AudioContext): MicrophoneResources {
  let stopSession: (() => void) | undefined;
  let pipeline: Awaited<ReturnType<typeof createMicrophoneAnalysisPipeline>> | undefined;
  let timer: number | undefined;
  const closeContext = createContextCloser(context);
  return {
    setSessionStop: (nextStop) => {
      stopSession = nextStop;
    },
    setPipeline: (nextPipeline) => {
      pipeline = nextPipeline;
    },
    setTimer: (nextTimer) => {
      timer = nextTimer;
    },
    cleanup: () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
      const activePipeline = pipeline;
      pipeline = undefined;
      activePipeline?.stop();
      const stopActiveSession = stopSession;
      stopSession = undefined;
      stopActiveSession?.();
      closeContext();
    },
  };
}

function createContextCloser(context: AudioContext): () => void {
  let contextClosed = false;
  return () => {
    if (contextClosed) return;
    contextClosed = true;
    void context.close();
  };
}

async function prepareMicrophoneCapture(request: Readonly<{
  analysisSettings: AudioEvaluationSettings;
  context: AudioContext;
  durationSeconds: number;
  frameSize: 2048 | 4096;
  gate: AnalysisRequestGate;
  onAnalysis: AnalysisStateSetters["onAnalysis"];
  resources: MicrophoneResources;
  setSettings: (settings: SafeMediaSettings | null) => void;
  setStatus: AnalysisStateSetters["setStatus"];
}>): Promise<boolean> {
  const { analysisSettings, context, durationSeconds, frameSize, gate, onAnalysis, resources, setSettings, setStatus } = request;
  const session = await startMicrophoneSession({ userInitiated: true, durationSeconds });
  resources.setSessionStop(session.stop);
  if (!gate.isCurrent()) return false;
  setSettings(session.settings);
  if (context.state === "suspended") await context.resume();
  if (!gate.isCurrent()) return false;
  const pipeline = await createMicrophoneAnalysisPipeline(context, session.stream, {
    frameSize,
    queueCapacity: AUDIO_ANALYSIS_LIMITS.defaultQueueCapacity,
    onsetSensitivity: analysisSettings.onsetSensitivity,
    workletModuleUrl: captureProcessorModuleUrl,
    workerFactory: createStreamingAnalysisWorker,
    onResult: (frame, queue, temporal) => {
      if (!gate.isCurrent()) return;
      onAnalysis(microphoneFrameToEvaluation(frame, temporal, queue, analysisSettings));
      setStatus(`Capturing locally · ${Math.max(0, durationSeconds).toFixed(0)} s maximum · ${queue.sequenceGaps + queue.overflowFrames + queue.staleFrames} reported frame gaps`);
    },
    onError: (message) => {
      if (gate.isCurrent()) setStatus(`Analysis worker: ${message}`);
    },
  });
  resources.setPipeline(pipeline);
  return gate.isCurrent();
}

function finishMicrophoneCapture(request: Readonly<{
  cleanup: () => void;
  gate: AnalysisRequestGate;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string) => void;
}>): void {
  const { cleanup, gate, setBusy, setStatus } = request;
  cleanup();
  gate.clearCleanup(cleanup);
  if (!gate.isCurrent()) return;
  setBusy(false);
  setStatus("Microphone segment complete. Only the displayed derived features can be recorded.");
}

type FileAnalysisRequest = Readonly<{
  analysisSettings: AudioEvaluationSettings;
  fileRef: MutableRefObject<File | null>;
  frameSize: 2048 | 4096;
  gate: AnalysisRequestGate;
  selectionDuration: number;
  selectionStart: number;
  state: AnalysisStateSetters;
}>;

export async function analyzeFileSelection(request: FileAnalysisRequest): Promise<void> {
  const { analysisSettings, fileRef, frameSize, gate, selectionDuration, selectionStart, state } = request;
  const { onAnalysis, setBusy, setStatus } = state;
  const file = fileRef.current;
  if (!file) {
    setStatus("Choose a browser-decodable audio/* file first.");
    return;
  }
  const context = createAudioContext();
  if (!context) {
    setStatus("File analysis is unavailable because Web Audio is not supported.");
    return;
  }
  beginAnalysis(state, "Decoding the bounded selection locally…");
  const controller = new AbortController();
  const cleanup = createFileCleanup(context, controller);
  gate.registerCleanup(cleanup);
  try {
    const decoded = await decodeAudioSelection(file, context, { startSeconds: selectionStart, endSeconds: selectionStart + selectionDuration });
    if (!isCurrentFileAnalysis(gate, controller)) return;
    const analysis = await analyzeDecodedFile({ analysisSettings, controller, decoded, frameSize });
    if (!isCurrentFileAnalysis(gate, controller)) return;
    publishFileAnalysis({ analysis, analysisSettings, fileRef, onAnalysis, provenance: decoded.provenance, setStatus });
  } catch (error) {
    if (gate.isCurrent()) {
      setStatus(error instanceof Error ? error.message : "The local file analysis failed.");
    }
  } finally {
    cleanup();
    gate.clearCleanup(cleanup);
    if (gate.isCurrent()) setBusy(false);
  }
}

function createFileCleanup(context: AudioContext, controller: AbortController): () => void {
  const closeContext = createContextCloser(context);
  return () => {
    controller.abort();
    closeContext();
  };
}

function isCurrentFileAnalysis(gate: AnalysisRequestGate, controller: AbortController): boolean {
  return gate.isCurrent() && !controller.signal.aborted;
}

async function analyzeDecodedFile(request: Readonly<{
  analysisSettings: AudioEvaluationSettings;
  controller: AbortController;
  decoded: Awaited<ReturnType<typeof decodeAudioSelection>>;
  frameSize: 2048 | 4096;
}>) {
  const { analysisSettings, controller, decoded, frameSize } = request;
  return analyzeSelectionInWorker(decoded.samples, decoded.provenance.sampleRateHz, {
    frameSize,
    onsetSensitivity: analysisSettings.onsetSensitivity,
    signal: controller.signal,
    workerFactory: createSelectionAnalysisWorker,
  });
}

function publishFileAnalysis(request: Readonly<{
  analysis: Awaited<ReturnType<typeof analyzeSelectionInWorker>>;
  analysisSettings: AudioEvaluationSettings;
  fileRef: MutableRefObject<File | null>;
  onAnalysis: AnalysisStateSetters["onAnalysis"];
  provenance: Awaited<ReturnType<typeof decodeAudioSelection>>["provenance"];
  setStatus: AnalysisStateSetters["setStatus"];
}>): void {
  const { analysis, analysisSettings, fileRef, onAnalysis, provenance, setStatus } = request;
  onAnalysis(selectionToEvaluation(analysis, provenance, analysisSettings));
  fileRef.current = null;
  setStatus(`Local analysis complete: ${analysis.durationSeconds.toFixed(2)} s, ${analysis.frames.length} frames. Raw audio was discarded.`);
}
