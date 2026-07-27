import type { MutableRefObject } from "react";
import { startMicrophoneSession } from "../../audio/capture";
import {
  captureProcessorModuleUrl,
  createSelectionAnalysisWorker,
  createStreamingAnalysisWorker,
} from "../../audio/browserRuntime";
import { AUDIO_ANALYSIS_LIMITS, type SafeMediaSettings } from "../../audio/contracts";
import { decodeAudioSelection } from "../../audio/fileInput";
import { analyzeSelectionInWorker, createMicrophoneAnalysisPipeline } from "../../audio/workerClient";
import {
  microphoneFrameToLabEvaluation,
  selectionToLabEvaluation,
  type AudioEvaluationSettings,
} from "../../labs/audioEvaluation";
import type { LabEvaluation } from "../../labs/types";

type AnalysisStateSetters = Readonly<{
  onAnalysis: (evaluation: LabEvaluation | null) => void;
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
  setBusy(true);
  setStatus("Requesting a local microphone segment…");
  onAnalysis(null);
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) {
    setBusy(false);
    setStatus("Microphone analysis is unavailable because Web Audio is not supported.");
    return;
  }
  const context = new AudioContextCtor();
  let stopSession: (() => void) | undefined;
  let pipeline: Awaited<ReturnType<typeof createMicrophoneAnalysisPipeline>> | undefined;
  let timer: number | undefined;
  let contextClosed = false;
  const cleanup = (): void => {
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
    if (!contextClosed) {
      contextClosed = true;
      void context.close();
    }
  };
  gate.registerCleanup(cleanup);
  try {
    const session = await startMicrophoneSession({ userInitiated: true, durationSeconds });
    stopSession = session.stop;
    if (!gate.isCurrent()) {
      cleanup();
      return;
    }
    setSettings(session.settings);
    if (context.state === "suspended") await context.resume();
    if (!gate.isCurrent()) {
      cleanup();
      return;
    }
    pipeline = await createMicrophoneAnalysisPipeline(context, session.stream, {
      frameSize,
      queueCapacity: AUDIO_ANALYSIS_LIMITS.defaultQueueCapacity,
      onsetSensitivity: analysisSettings.onsetSensitivity,
      workletModuleUrl: captureProcessorModuleUrl,
      workerFactory: createStreamingAnalysisWorker,
      onResult: (frame, queue, temporal) => {
        if (!gate.isCurrent()) return;
        onAnalysis(microphoneFrameToLabEvaluation(frame, temporal, queue, analysisSettings));
        setStatus(`Capturing locally · ${Math.max(0, durationSeconds).toFixed(0)} s maximum · ${queue.sequenceGaps + queue.overflowFrames + queue.staleFrames} reported frame gaps`);
      },
      onError: (message) => {
        if (gate.isCurrent()) setStatus(`Analysis worker: ${message}`);
      },
    });
    if (!gate.isCurrent()) {
      cleanup();
      return;
    }
    timer = window.setTimeout(
      () => finishMicrophoneCapture({ cleanup, gate, setBusy, setStatus }),
      durationSeconds * 1000,
    );
  } catch (error) {
    cleanup();
    gate.clearCleanup(cleanup);
    if (!gate.isCurrent()) return;
    setBusy(false);
    setStatus(error instanceof Error ? error.message : "Microphone analysis could not start.");
  }
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
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) {
    setStatus("File analysis is unavailable because Web Audio is not supported.");
    return;
  }
  setBusy(true);
  setStatus("Decoding the bounded selection locally…");
  onAnalysis(null);
  const context = new AudioContextCtor();
  const controller = new AbortController();
  let contextClosed = false;
  const cleanup = (): void => {
    controller.abort();
    if (!contextClosed) {
      contextClosed = true;
      void context.close();
    }
  };
  gate.registerCleanup(cleanup);
  try {
    const decoded = await decodeAudioSelection(file, context, { startSeconds: selectionStart, endSeconds: selectionStart + selectionDuration });
    if (!gate.isCurrent() || controller.signal.aborted) return;
    const analysis = await analyzeSelectionInWorker(decoded.samples, decoded.provenance.sampleRateHz, {
      frameSize,
      onsetSensitivity: analysisSettings.onsetSensitivity,
      signal: controller.signal,
      workerFactory: createSelectionAnalysisWorker,
    });
    if (!gate.isCurrent() || controller.signal.aborted) return;
    onAnalysis(selectionToLabEvaluation(analysis, decoded.provenance, analysisSettings));
    fileRef.current = null;
    setStatus(`Local analysis complete: ${analysis.durationSeconds.toFixed(2)} s, ${analysis.frames.length} frames. Raw audio was discarded.`);
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
