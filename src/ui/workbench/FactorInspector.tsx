import { useId, useState, type ChangeEvent, type ReactElement } from "react";
import type {
  FactorDefinition,
  FactorValue,
  InputMode,
  LessonDefinition,
  NumberFactor,
} from "../../curriculum/contracts";

export type FactorInspectorProps = Readonly<{
  lesson: LessonDefinition;
  values: Readonly<Record<string, FactorValue>>;
  inputMode: InputMode;
  onFactorChange: (factorId: string, value: FactorValue) => void;
  onInputModeChange: (mode: InputMode) => void;
  disabled?: boolean;
  compact?: boolean;
}>;

const inputModeLabels = new Map<InputMode, string>([
  ["synthetic", "Synthetic signal"],
  ["microphone", "Microphone segment"],
  ["file", "Audio file segment"],
]);

export function FactorInspector({
  lesson,
  values,
  inputMode,
  onFactorChange,
  onInputModeChange,
  disabled = false,
  compact = false,
}: FactorInspectorProps): ReactElement {
  const instanceId = useId();
  const [otherFactorsOpen, setOtherFactorsOpen] = useState(false);
  const valuesById = new Map(Object.entries(values));

  return (
    <aside className="mm-factor-inspector" aria-labelledby={`${instanceId}-heading`}>
      <div className="mm-factor-inspector__heading">
        <div>
          <span>Factor inspector</span>
          <h2 id={`${instanceId}-heading`}>Model factors</h2>
        </div>
        <strong className={disabled ? "mm-factor-inspector__lock" : undefined}>
          {disabled ? "Locked" : "Editable"}
        </strong>
      </div>

      {disabled ? <p className="mm-factor-inspector__guidance">Make a prediction to unlock the factors.</p> : null}
      {!compact || lesson.inputModes.length > 1 ? <InputSourceControl
        disabled={disabled}
        inputMode={inputMode}
        inputModes={lesson.inputModes}
        inputId={`${instanceId}-input-mode`}
        onInputModeChange={onInputModeChange}
      /> : null}
      <FactorControls
        disabled={disabled}
        factors={compact ? lesson.factors.slice(0, 1) : lesson.factors}
        instanceId={instanceId}
        onFactorChange={onFactorChange}
        valuesById={valuesById}
      />
      {compact && lesson.factors.length > 1 ? <details className="mm-other-factors" open={otherFactorsOpen} onToggle={(event) => { setOtherFactorsOpen(event.currentTarget.open); }} onInvalidCapture={() => { setOtherFactorsOpen(true); }}><summary>Adjust other factors</summary><FactorControls disabled={disabled} factors={lesson.factors.slice(1)} instanceId={instanceId} onFactorChange={onFactorChange} valuesById={valuesById} /></details> : null}
    </aside>
  );
}

function InputSourceControl({ disabled, inputId, inputMode, inputModes, onInputModeChange }: Readonly<{
  disabled: boolean;
  inputId: string;
  inputMode: InputMode;
  inputModes: readonly InputMode[];
  onInputModeChange: (mode: InputMode) => void;
}>): ReactElement {
  if (inputModes.length === 1) return <p className="mm-model-source">Synthetic factors directly control the published deterministic model.</p>;
  return <fieldset className="mm-factor-inspector__source" disabled={disabled}>
    <legend>Input source</legend>
    <label htmlFor={inputId}>Analysis source</label>
    <select id={inputId} value={inputMode} onChange={(event) => {
      onInputModeChange(event.currentTarget.value as InputMode);
    }}>
      {inputModes.map((mode) => <option key={mode} value={mode}>{inputModeLabels.get(mode)}</option>)}
    </select>
    <p>{inputMode === "synthetic"
      ? "Synthetic factors directly control the published deterministic model."
      : "Recorded sound is analyzed locally and remains uncalibrated. Factor values describe the learner-declared condition unless the lesson identifies an analysis setting."}</p>
  </fieldset>;
}

function FactorControls({ disabled, factors, instanceId, onFactorChange, valuesById }: Readonly<{
  disabled: boolean;
  factors: readonly FactorDefinition[];
  instanceId: string;
  onFactorChange: (factorId: string, value: FactorValue) => void;
  valuesById: ReadonlyMap<string, FactorValue>;
}>): ReactElement {
  return <fieldset className="mm-factor-inspector__factors" disabled={disabled}>
    <legend>Experimental factors</legend>
    {factors.map((factor) => <FactorControl
      factor={factor}
      helpId={`${instanceId}-${factor.id}-help`}
      inputId={`${instanceId}-${factor.id}`}
      key={factor.id}
      onChange={onFactorChange}
      value={valuesById.get(factor.id) ?? factor.defaultValue}
    />)}
  </fieldset>;
}

type FactorControlProps = Readonly<{
  factor: FactorDefinition;
  value: FactorValue;
  inputId: string;
  helpId: string;
  onChange: (factorId: string, value: FactorValue) => void;
}>;

function FactorControl({
  factor,
  value,
  inputId,
  helpId,
  onChange,
}: FactorControlProps): ReactElement {
  if (factor.kind === "toggle") {
    return (
      <div className="mm-factor-control mm-factor-control--toggle">
        <label htmlFor={inputId}>
          <input
            aria-describedby={helpId}
            checked={typeof value === "boolean" ? value : factor.defaultValue}
            id={inputId}
            onChange={(event) => {
              onChange(factor.id, event.currentTarget.checked);
            }}
            type="checkbox"
          />
          <span>{factor.label}</span>
        </label>
        <p id={helpId}>{factor.help}</p>
      </div>
    );
  }

  if (factor.kind === "select") {
    return (
      <div className="mm-factor-control">
        <label htmlFor={inputId}>{factor.label}</label>
        <select
          aria-describedby={helpId}
          id={inputId}
          onChange={(event) => {
            onChange(factor.id, event.currentTarget.value);
          }}
          value={typeof value === "string" ? value : factor.defaultValue}
        >
          {factor.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p id={helpId}>{factor.help}</p>
      </div>
    );
  }

  return <NumberFactorControl factor={factor} value={typeof value === "number" ? value : factor.defaultValue} inputId={inputId} helpId={helpId} onChange={onChange} />;
}

function NumberFactorControl({ factor, value, inputId, helpId, onChange }: Readonly<{
  factor: NumberFactor; value: number; inputId: string; helpId: string;
  onChange: (factorId: string, value: FactorValue) => void;
}>): ReactElement {
  const [state, setState] = useState({ source: value, draft: String(value), invalid: false });
  if (state.source !== value) setState({ source: value, draft: String(value), invalid: false });
  const errorId = `${inputId}-error`;
  function handleNumberChange(event: ChangeEvent<HTMLInputElement>): void {
    const input = event.currentTarget;
    const next = validNumberFactorValue(input.valueAsNumber, factor);
    const invalid = input.value.trim() === "" || !input.validity.valid || next === null;
    setState({ source: invalid ? value : input.valueAsNumber, draft: input.value, invalid });
    if (!invalid && next !== null) onChange(factor.id, next);
  }
  function step(direction: -1 | 1): void {
    const next = stepNumberFactorValue(value, factor, direction);
    setState({ source: next, draft: String(next), invalid: false });
    onChange(factor.id, next);
  }
  return <div className="mm-factor-control">
    <label htmlFor={inputId}>{factor.label}</label>
    <div className="mm-factor-control__number mm-number-stepper">
      <button type="button" aria-label={`Decrease ${factor.label}`} disabled={state.invalid || value <= factor.min} onClick={() => { step(-1); }}>−</button>
      <input aria-describedby={`${helpId}${state.invalid ? ` ${errorId}` : ""}`} aria-invalid={state.invalid || undefined} id={inputId} max={factor.max} min={factor.min} onChange={handleNumberChange} step={factor.step} type="number" required value={state.draft} />
      <button type="button" aria-label={`Increase ${factor.label}`} disabled={state.invalid || value >= factor.max} onClick={() => { step(1); }}>+</button>
      {factor.unit ? <span aria-hidden="true">{factor.unit}</span> : null}
    </div>
    <p id={helpId}>Range: {factor.min}–{factor.max}{factor.unit ? ` ${factor.unit}` : ""}. Step: {factor.step}. <span className="mm-factor-help">{factor.help}</span></p>
    {state.invalid ? <p className="mm-factor-error" id={errorId} role="alert">Enter a number from {factor.min} to {factor.max} in steps of {factor.step} before recording.</p> : null}
  </div>;
}

export function stepNumberFactorValue(value: number, factor: NumberFactor, direction: -1 | 1): number {
  return Math.min(factor.max, Math.max(factor.min, Number((value + direction * factor.step).toPrecision(12))));
}

export function validNumberFactorValue(value: number, factor: FactorDefinition): number | null {
  if (factor.kind !== "number") return null;
  if (!Number.isFinite(value) || value < factor.min || value > factor.max) return null;
  return value;
}
