import type { ChangeEvent, ReactElement } from "react";

/** Browser-reported audio settings shown to the learner; structurally the analysis layer's safe media settings. */
export type SafeSettingsValues = Readonly<Record<string, number | boolean | undefined>>;

export function FrameSizeControl({
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

export function MicrophoneControls({
  busy,
  durationSeconds,
  maximumSeconds,
  minimumSeconds,
  onDurationChange,
  onStart,
  settings,
}: Readonly<{
  busy: boolean;
  durationSeconds: number;
  maximumSeconds: number;
  minimumSeconds: number;
  onDurationChange: (durationSeconds: number) => void;
  onStart: () => void;
  settings: SafeSettingsValues | null;
}>): ReactElement {
  return (
    <>
      <label>
        <span>Capture duration</span>
        <input
          disabled={busy}
          max={maximumSeconds}
          min={minimumSeconds}
          step="1"
          type="number"
          value={durationSeconds}
          onChange={(event) => {
            const next = validNumberInput(event, minimumSeconds, maximumSeconds);
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

export function FileControls({
  busy,
  maximumSelectionSeconds,
  onAnalyze,
  onFileChange,
  onSelectionDurationChange,
  onSelectionStartChange,
  selectionDuration,
  selectionStart,
}: Readonly<{
  busy: boolean;
  maximumSelectionSeconds: number;
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
        <AudioRangeControl busy={busy} label="Duration" maximum={maximumSelectionSeconds} minimum={0.1} onChange={onSelectionDurationChange} value={selectionDuration} />
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

function SafeSettings({ settings }: Readonly<{ settings: SafeSettingsValues }>): ReactElement {
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
