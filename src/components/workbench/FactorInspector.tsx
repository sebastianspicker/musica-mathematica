import { useId, type ChangeEvent, type ReactElement } from "react";
import type {
  FactorDefinition,
  FactorValue,
  InputMode,
  LabLesson,
} from "../../labs/types";

export type FactorInspectorProps = Readonly<{
  lesson: LabLesson;
  values: Readonly<Record<string, FactorValue>>;
  inputMode: InputMode;
  onFactorChange: (factorId: string, value: FactorValue) => void;
  onInputModeChange: (mode: InputMode) => void;
  disabled?: boolean;
}>;

const inputModeLabels: Readonly<Record<InputMode, string>> = {
  synthetic: "Synthetic signal",
  microphone: "Microphone segment",
  file: "Audio file segment",
};

export function FactorInspector({
  lesson,
  values,
  inputMode,
  onFactorChange,
  onInputModeChange,
  disabled = false,
}: FactorInspectorProps): ReactElement {
  const instanceId = useId();

  return (
    <aside className="mm-factor-inspector" aria-labelledby={`${instanceId}-heading`}>
      <div className="mm-factor-inspector__heading">
        <div>
          <span>Factor inspector</span>
          <h2 id={`${instanceId}-heading`}>Factors</h2>
        </div>
        <strong className={disabled ? "mm-factor-inspector__lock" : undefined}>
          {disabled ? "Locked until prediction" : `${lesson.factors.length} controlled`}
        </strong>
      </div>

      <fieldset className="mm-factor-inspector__source" disabled={disabled}>
        <legend>Input source</legend>
        <label htmlFor={`${instanceId}-input-mode`}>Analysis source</label>
        <select
          id={`${instanceId}-input-mode`}
          value={inputMode}
          onChange={(event) => onInputModeChange(event.currentTarget.value as InputMode)}
        >
          {lesson.inputModes.map((mode) => (
            <option key={mode} value={mode}>{inputModeLabels[mode]}</option>
          ))}
        </select>
        <p>{inputMode === "synthetic"
          ? "Synthetic factors directly control the published deterministic model."
          : "Recorded sound is analyzed locally and remains uncalibrated. Factor values describe the learner-declared condition unless the lesson identifies an analysis setting."}</p>
      </fieldset>

      <fieldset className="mm-factor-inspector__factors" disabled={disabled}>
        <legend>Experimental factors</legend>
        {lesson.factors.map((factor) => (
          <FactorControl
            factor={factor}
            helpId={`${instanceId}-${factor.id}-help`}
            inputId={`${instanceId}-${factor.id}`}
            key={factor.id}
            onChange={onFactorChange}
            value={values[factor.id] ?? factor.defaultValue}
          />
        ))}
      </fieldset>
    </aside>
  );
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
            onChange={(event) => onChange(factor.id, event.currentTarget.checked)}
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
          onChange={(event) => onChange(factor.id, event.currentTarget.value)}
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

  const numberValue = typeof value === "number" ? value : factor.defaultValue;

  function handleNumberChange(event: ChangeEvent<HTMLInputElement>): void {
    const input = event.currentTarget;
    if (input.value.trim() === "" || !input.validity.valid) return;
    const nextValue = validNumberFactorValue(input.valueAsNumber, factor);
    if (nextValue !== null) onChange(factor.id, nextValue);
  }

  return (
    <div className="mm-factor-control">
      <label htmlFor={inputId}>{factor.label}</label>
      <div className="mm-factor-control__number">
        <input
          aria-describedby={helpId}
          id={inputId}
          max={factor.max}
          min={factor.min}
          onChange={handleNumberChange}
          step={factor.step}
          type="number"
          value={numberValue}
        />
        {factor.unit ? <span aria-hidden="true">{factor.unit}</span> : null}
      </div>
      <p id={helpId}>
        {factor.help}{factor.unit ? ` Unit: ${factor.unit}.` : ""}
      </p>
    </div>
  );
}

export function validNumberFactorValue(value: number, factor: FactorDefinition): number | null {
  if (factor.kind !== "number") return null;
  if (!Number.isFinite(value) || value < factor.min || value > factor.max) return null;
  return value;
}
