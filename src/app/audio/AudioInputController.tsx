import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MutableRefObject,
  type ReactElement,
} from "react";
import { AUDIO_ANALYSIS_LIMITS, type SafeMediaSettings } from "../../audio/analysis/contracts";
import { audioAnalysisSettings, type FactorValue, type InputMode, type LessonDefinition, type EvaluationOutput } from "../../curriculum/contracts";
import {
  analyzeFileSelection,
  startMicrophoneAnalysis,
  type AnalysisRequestGate,
} from "./audioInputAnalysis";
import { FileControls, FrameSizeControl, MicrophoneControls } from "../../ui/audio/AudioInputControls";

export type AudioInputControllerProps = Readonly<{
  mode: InputMode;
  lesson: LessonDefinition;
  factors: Readonly<Record<string, FactorValue>>;
  onAnalysis: (evaluation: EvaluationOutput | null) => void;
}>;

export function AudioInputController({ mode, lesson, factors, onAnalysis }: AudioInputControllerProps): ReactElement | null {
  const cleanupRef = useRef<(() => void) | null>(null);
  const requestVersionRef = useRef(0);
  const fileRef = useRef<File | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(8);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionDuration, setSelectionDuration] = useState(10);
  const [frameSize, setFrameSize] = useState<2048 | 4096>(2048);
  const [status, setStatus] = useState("No bounded segment has been analyzed.");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<SafeMediaSettings | null>(null);
  const analysisSettings = audioAnalysisSettings(lesson, factors);
  const analysisState = { onAnalysis, setBusy, setStatus };

  useEffect(() => {
    cancelPendingAnalysis(requestVersionRef, cleanupRef);
    fileRef.current = null;
    setBusy(false);
    setSettings(null);
    setStatus("No bounded segment has been analyzed.");
    onAnalysis(null);
    return () => {
      cancelPendingAnalysis(requestVersionRef, cleanupRef);
    };
  }, [factors, mode, onAnalysis]);

  if (mode === "synthetic") return null;

  function invalidateAnalysis(nextStatus: string): void {
    cancelPendingAnalysis(requestVersionRef, cleanupRef);
    setBusy(false);
    onAnalysis(null);
    setStatus(nextStatus);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>): void {
    cancelPendingAnalysis(requestVersionRef, cleanupRef);
    setBusy(false);
    fileRef.current = event.currentTarget.files?.[0] ?? null;
    onAnalysis(null);
    setStatus(fileRef.current
      ? "Audio file selected transiently. Its name is not retained; choose the range and analyze locally."
      : "No file selected.");
  }

  function beginMicrophoneCapture(): void {
    void startMicrophoneAnalysis({
      analysisSettings,
      durationSeconds,
      frameSize,
      gate: beginAnalysisRequest(requestVersionRef, cleanupRef),
      state: analysisState,
      setSettings,
    });
  }

  function beginFileAnalysis(): void {
    void analyzeFileSelection({
      analysisSettings,
      fileRef,
      frameSize,
      gate: beginAnalysisRequest(requestVersionRef, cleanupRef),
      selectionDuration,
      selectionStart,
      state: analysisState,
    });
  }

  return (
    <section
      aria-busy={busy}
      className="mm-audio-input"
      data-state={busy ? "busy" : "idle"}
      aria-labelledby="mm-audio-input-heading"
    >
      <div className="mm-audio-input__heading">
        <h2 id="mm-audio-input-heading">Local audio analysis</h2>
        <strong>Uncalibrated</strong>
      </div>
      <p className="mm-audio-input__boundary">
        Audio is never persisted, transmitted, or downloaded. Only bounded derived features and provenance can enter a run.
      </p>
      <FrameSizeControl
        busy={busy}
        frameSize={frameSize}
        onChange={(next) => {
          setFrameSize(next);
          invalidateAnalysis("Frame size changed. Analyze a fresh bounded segment before recording.");
        }}
      />

      {mode === "microphone" ? (
        <MicrophoneControls
          busy={busy}
          durationSeconds={durationSeconds}
          maximumSeconds={AUDIO_ANALYSIS_LIMITS.maximumMicrophoneSeconds}
          minimumSeconds={AUDIO_ANALYSIS_LIMITS.minimumMicrophoneSeconds}
          onDurationChange={(next) => {
            setDurationSeconds(next);
            invalidateAnalysis("Capture duration changed. Capture a fresh segment before recording.");
          }}
          onStart={beginMicrophoneCapture}
          settings={settings}
        />
      ) : (
        <FileControls
          busy={busy}
          maximumSelectionSeconds={AUDIO_ANALYSIS_LIMITS.maximumSelectionSeconds}
          onAnalyze={beginFileAnalysis}
          onFileChange={chooseFile}
          onSelectionDurationChange={(next) => {
            setSelectionDuration(next);
            invalidateAnalysis("Selection range changed. Analyze the fresh range before recording.");
          }}
          onSelectionStartChange={(next) => {
            setSelectionStart(next);
            invalidateAnalysis("Selection range changed. Analyze the fresh range before recording.");
          }}
          selectionDuration={selectionDuration}
          selectionStart={selectionStart}
        />
      )}
      <p className="mm-audio-input__status" role="status">{status}</p>
    </section>
  );
}

function cancelPendingAnalysis(
  requestVersionRef: MutableRefObject<number>,
  cleanupRef: MutableRefObject<(() => void) | null>,
): void {
  requestVersionRef.current += 1;
  const cleanup = cleanupRef.current;
  cleanupRef.current = null;
  cleanup?.();
}

function beginAnalysisRequest(
  requestVersionRef: MutableRefObject<number>,
  cleanupRef: MutableRefObject<(() => void) | null>,
): AnalysisRequestGate {
  cancelPendingAnalysis(requestVersionRef, cleanupRef);
  const requestVersion = requestVersionRef.current;
  const isCurrent = (): boolean => requestVersionRef.current === requestVersion;
  return {
    isCurrent,
    registerCleanup: (cleanup) => {
      if (!isCurrent()) {
        cleanup();
        return;
      }
      cleanupRef.current = cleanup;
    },
    clearCleanup: (cleanup) => {
      if (isCurrent() && cleanupRef.current === cleanup) cleanupRef.current = null;
    },
  };
}
