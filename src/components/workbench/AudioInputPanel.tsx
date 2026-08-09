import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MutableRefObject,
  type ReactElement,
} from "react";
import { AUDIO_ANALYSIS_LIMITS, type SafeMediaSettings } from "../../audio/contracts";
import { type AudioEvaluationSettings } from "../../labs/audioEvaluation";
import type { FactorValue, InputMode, LabEvaluation, LabLesson } from "../../labs/types";
import {
  analyzeFileSelection,
  startMicrophoneAnalysis,
  type AnalysisRequestGate,
} from "./audioInputAnalysis";

export type AudioInputPanelProps = Readonly<{
  mode: InputMode;
  lesson: LabLesson;
  factors: Readonly<Record<string, FactorValue>>;
  onAnalysis: (evaluation: LabEvaluation | null) => void;
}>;

function AudioInputPanel({ mode, lesson, factors, onAnalysis }: AudioInputPanelProps): ReactElement | null {
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
  const analysisSettings = audioSettingsFor(lesson, factors);
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

export { AudioInputPanel };

function FrameSizeControl({
  busy,
  frameSize,
  onChange,
}: Readonly<{
  busy: boolean;
  frameSize: 2048 | 4096;
  onChange: (frameSize: 2048 | 4096) => void;
}>): ReactElement {
  return (
    <label>
      <span>Hann frame size</span>
      <select disabled={busy} value={frameSize} onChange={(event) => {
        onChange(Number(event.currentTarget.value) as 2048 | 4096);
      }}>
        <option value="2048">2,048 samples · 50% overlap</option>
        <option value="4096">4,096 samples · 50% overlap</option>
      </select>
    </label>
  );
}

function MicrophoneControls({
  busy,
  durationSeconds,
  onDurationChange,
  onStart,
  settings,
}: Readonly<{
  busy: boolean;
  durationSeconds: number;
  onDurationChange: (durationSeconds: number) => void;
  onStart: () => void;
  settings: SafeMediaSettings | null;
}>): ReactElement {
  return (
    <>
      <label>
        <span>Capture duration</span>
        <input
          disabled={busy}
          max={AUDIO_ANALYSIS_LIMITS.maximumMicrophoneSeconds}
          min={AUDIO_ANALYSIS_LIMITS.minimumMicrophoneSeconds}
          step="1"
          type="number"
          value={durationSeconds}
          onChange={(event) => {
            const next = validNumberInput(event, AUDIO_ANALYSIS_LIMITS.minimumMicrophoneSeconds, AUDIO_ANALYSIS_LIMITS.maximumMicrophoneSeconds);
            if (next !== null) onDurationChange(next);
          }}
        />
      </label>
      <button className="mm-primary-action" disabled={busy} type="button" onClick={onStart}>
        {busy ? "Capturing locally…" : `Capture ${durationSeconds} s locally`}
      </button>
      <p>Echo cancellation, noise suppression, and automatic gain control are requested off; actual safe settings are shown below without device names or IDs.</p>
      {settings ? <SafeSettings settings={settings} /> : null}
    </>
  );
}

function FileControls({
  busy,
  onAnalyze,
  onFileChange,
  onSelectionDurationChange,
  onSelectionStartChange,
  selectionDuration,
  selectionStart,
}: Readonly<{
  busy: boolean;
  onAnalyze: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelectionDurationChange: (duration: number) => void;
  onSelectionStartChange: (start: number) => void;
  selectionDuration: number;
  selectionStart: number;
}>): ReactElement {
  return (
    <>
      <label>
        <span>Audio file · maximum 25 MiB, decoded maximum 90 s</span>
        <input accept="audio/*" disabled={busy} type="file" onChange={onFileChange} />
      </label>
      <div className="mm-audio-input__range">
        <AudioRangeControl busy={busy} label="Start" maximum={89} minimum={0} onChange={onSelectionStartChange} value={selectionStart} />
        <AudioRangeControl busy={busy} label="Duration" maximum={AUDIO_ANALYSIS_LIMITS.maximumSelectionSeconds} minimum={0.1} onChange={onSelectionDurationChange} value={selectionDuration} />
      </div>
      <button className="mm-primary-action" disabled={busy} type="button" onClick={onAnalyze}>
        {busy ? "Analyzing locally…" : "Analyze selected range"}
      </button>
    </>
  );
}

function AudioRangeControl({
  busy,
  label,
  maximum,
  minimum,
  onChange,
  value,
}: Readonly<{
  busy: boolean;
  label: string;
  maximum: number;
  minimum: number;
  onChange: (value: number) => void;
  value: number;
}>): ReactElement {
  return (
    <label>
      <span>{label}</span>
      <input
        disabled={busy}
        max={maximum}
        min={minimum}
        step="0.1"
        type="number"
        value={value}
        onChange={(event) => {
          const next = validNumberInput(event, minimum, maximum);
          if (next !== null) onChange(next);
        }}
      />
    </label>
  );
}

function SafeSettings({ settings }: Readonly<{ settings: SafeMediaSettings }>): ReactElement {
  const entries = Object.entries(settings);
  return (
    <dl className="mm-audio-settings">
      {entries.length === 0 ? <div><dt>Browser report</dt><dd>No safe audio settings exposed</dd></div> : entries.map(([key, value]) => (
        <div key={key}><dt>{humanize(key)}</dt><dd>{String(value)}</dd></div>
      ))}
    </dl>
  );
}

function humanize(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
}

function audioSettingsFor(
  lesson: LabLesson,
  factors: Readonly<Record<string, FactorValue>>,
): AudioEvaluationSettings {
  if (lesson.id !== "recorded-onset-hypotheses") return {};
  const onsetSensitivity = factors.threshold;
  const meterBias = factors.meterBias;
  return {
    ...(typeof onsetSensitivity === "number" ? { onsetSensitivity } : {}),
    ...(meterBias === "mixed" || meterBias === "duple" || meterBias === "triple" ? { meterBias } : {}),
  };
}

function validNumberInput(
  event: ChangeEvent<HTMLInputElement>,
  minimum: number,
  maximum: number,
): number | null {
  const input = event.currentTarget;
  const value = input.valueAsNumber;
  if (input.value.trim() === "" || !input.validity.valid || !Number.isFinite(value)) return null;
  return value >= minimum && value <= maximum ? value : null;
}
