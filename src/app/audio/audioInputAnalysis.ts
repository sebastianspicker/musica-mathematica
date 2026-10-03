import type { MutableRefObject } from "react";
import type { AudioAnalysisSettings, EvaluationOutput } from "../../curriculum/contracts";
import { AUDIO_ANALYSIS_LIMITS, type SafeMediaSettings } from "../../audio/analysis/contracts";
import { startMicrophoneSession, type MicrophoneSession } from "../../audio/browser/capture";
import { decodeAudioSelection } from "../../audio/browser/fileInput";
import {
  analyzeSelectionInWorker,
  prepareMicrophoneAnalysisPipeline,
  type AnalysisPipeline,
  type PreparedAnalysisPipeline,
} from "../../audio/browser/workerClient";
import {
  captureProcessorModuleUrl,
  createSelectionAnalysisWorker,
  createStreamingAnalysisWorker,
} from "../../audio/browser/runtime";
import {
  microphoneFrameToEvaluation,
  selectionToEvaluation,
} from "./mapAudioEvaluation";

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
  analysisSettings: AudioAnalysisSettings;
  durationSeconds: number;
  frameSize: 2048 | 4096;
  gate: AnalysisRequestGate;
  state: AnalysisStateSetters;
  setSettings: (settings: SafeMediaSettings | null) => void;
}>;

export async function startMicrophoneAnalysis(request: MicrophoneAnalysisRequest): Promise<void> {
  const { analysisSettings, durationSeconds, frameSize, gate, setSettings, state } = request;
  const { onAnalysis, setBusy, setStatus } = state;
  beginAnalysis(state, "Preparing local audio analysis…");
  const context = createAudioContext();
  if (!context) {
    setBusy(false);
    setStatus("Microphone analysis is unavailable because Web Audio is not supported.");
    return;
  }
  const resources = createMicrophoneResources(context);
  const { cleanup } = resources;
  gate.registerCleanup(cleanup);
  let analysisFailed = false;
  try {
    const preparation = prepareMicrophoneAnalysisPipeline(context, {
      frameSize,
      queueCapacity: AUDIO_ANALYSIS_LIMITS.defaultQueueCapacity,
      onsetSensitivity: analysisSettings.onsetSensitivity,
      workletModuleUrl: captureProcessorModuleUrl,
      workerFactory: createStreamingAnalysisWorker,
      onResult: (frame, queue, temporal) => {
        if (!gate.isCurrent() || analysisFailed) return;
        onAnalysis(microphoneFrameToEvaluation(frame, temporal, queue, analysisSettings));
        setStatus(`Capturing locally · ${Math.max(0, durationSeconds).toFixed(0)} s maximum · ${queue.sequenceGaps + queue.overflowFrames + queue.staleFrames} reported frame gaps`);
      },
      onError: (message) => {
        if (!gate.isCurrent()) return;
        analysisFailed = true;
        cleanup();
        gate.clearCleanup(cleanup);
        setBusy(false);
        setStatus(`Analysis worker: ${message}`);
      },
    });
    resources.setPreparation(preparation);
    if (analysisFailed) return;
    setStatus("Requesting a local microphone segment…");
    const session = await startMicrophoneSession({ userInitiated: true, durationSeconds });
    resources.setSessionStop(session.stop);
    if (!gate.isCurrent() || analysisFailed) return;
    setSettings(session.settings);
    const pipeline = await connectBeforeDeadline(context, preparation, session);
    if (!pipeline) {
      cleanup();
      gate.clearCleanup(cleanup);
      if (gate.isCurrent()) {
        setBusy(false);
        setStatus("Microphone capture ended before local analysis setup completed.");
      }
      return;
    }
    resources.setPipeline(pipeline);
    if (!gate.isCurrent()) return;
    setStatus(`Capturing locally · ${durationSeconds.toFixed(0)} s maximum · 0 reported frame gaps`);
    void finishAtSessionEnd({ cleanup, gate, pipeline, session, setBusy, setStatus });
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
  setPipeline: (pipeline: AnalysisPipeline) => void;
  setPreparation: (preparation: PreparedAnalysisPipeline) => void;
  setSessionStop: (stop: () => void) => void;
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
  let preparation: PreparedAnalysisPipeline | undefined;
  let pipeline: AnalysisPipeline | undefined;
  let cleaned = false;
  const closeContext = createContextCloser(context);
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    pipeline?.stop();
    preparation?.stop();
    stopSession?.();
    pipeline = undefined;
    preparation = undefined;
    stopSession = undefined;
    closeContext();
  };
  return {
    setSessionStop: (nextStop) => {
      if (cleaned) nextStop();
      else stopSession = nextStop;
    },
    setPreparation: (nextPreparation) => {
      if (cleaned) nextPreparation.stop();
      else preparation = nextPreparation;
    },
    setPipeline: (nextPipeline) => {
      if (cleaned) nextPipeline.stop();
      else pipeline = nextPipeline;
    },
    cleanup,
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

type ConnectionOutcome =
  | Readonly<{ kind: "connected"; pipeline: AnalysisPipeline }>
  | Readonly<{ kind: "ended" }>
  | Readonly<{ kind: "failed"; error: unknown }>;

async function connectBeforeDeadline(
  context: AudioContext,
  preparation: PreparedAnalysisPipeline,
  session: MicrophoneSession,
): Promise<AnalysisPipeline | null> {
  let sessionEnded = false;
  const ended = session.ended.then<ConnectionOutcome>(() => {
    sessionEnded = true;
    return { kind: "ended" };
  });
  const connection = (async (): Promise<ConnectionOutcome> => {
    if (context.state === "suspended") await context.resume();
    if (sessionEnded) return { kind: "ended" };
    return { kind: "connected", pipeline: await preparation.connect(session.stream) };
  })().catch<ConnectionOutcome>((error: unknown) => ({ kind: "failed", error }));
  const outcome = await Promise.race([connection, ended]);
  if (outcome.kind === "connected") return outcome.pipeline;
  if (outcome.kind === "failed") throw outcome.error;
  preparation.stop();
  return null;
}

async function finishAtSessionEnd(request: Readonly<{
  cleanup: () => void;
  gate: AnalysisRequestGate;
  pipeline: AnalysisPipeline;
  session: MicrophoneSession;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string) => void;
}>): Promise<void> {
  const { cleanup, gate, pipeline, session, setBusy, setStatus } = request;
  const reason = await session.ended;
  if (reason !== "deadline" || !gate.isCurrent()) return;
  try {
    await pipeline.finish();
    if (gate.isCurrent()) {
      setStatus("Microphone segment complete. Only the displayed derived features can be recorded.");
    }
  } catch (error) {
    if (gate.isCurrent()) {
      setStatus(error instanceof Error ? error.message : "Microphone analysis could not finish.");
    }
  } finally {
    cleanup();
    gate.clearCleanup(cleanup);
    if (gate.isCurrent()) setBusy(false);
  }
}

type FileAnalysisRequest = Readonly<{
  analysisSettings: AudioAnalysisSettings;
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
    const decoded = await decodeAudioSelection(
      file,
      context,
      { startSeconds: selectionStart, endSeconds: selectionStart + selectionDuration },
      { signal: controller.signal },
    );
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
  analysisSettings: AudioAnalysisSettings;
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
  analysisSettings: AudioAnalysisSettings;
  fileRef: MutableRefObject<File | null>;
  onAnalysis: AnalysisStateSetters["onAnalysis"];
  provenance: Awaited<ReturnType<typeof decodeAudioSelection>>["provenance"];
  setStatus: AnalysisStateSetters["setStatus"];
}>): void {
  const { analysis, analysisSettings, fileRef, onAnalysis, provenance, setStatus } = request;
  onAnalysis(selectionToEvaluation(analysis, provenance, analysisSettings));
  fileRef.current = null;
  setStatus(`Local analysis complete: ${analysis.durationSeconds.toFixed(2)} s, ${analysis.frameCount} frames. Raw audio was discarded.`);
}
