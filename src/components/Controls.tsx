import type { ReactElement } from "react";
import type { EnsembleConfig, RepertoireTexture, Topology } from "../simulation/ensemble";
import { textureOptions, topologyOptions } from "../simulation/options";
import { MathText } from "./MathText";

type ControlsProps = {
  config: EnsembleConfig;
  onChange: (patch: Partial<EnsembleConfig>) => void;
};

export function Controls({ config, onChange }: ControlsProps): ReactElement {
  return (
    <aside className="control-panel" aria-label="Simulation controls">
      <h2>Controls</h2>
      <Slider
        label="Musicians"
        max={16}
        min={2}
        onChange={(musicianCount) => onChange({ musicianCount })}
        step={1}
        symbolLatex="N"
        symbolLabel="N"
        value={config.musicianCount}
      />
      <Slider
        label="Tempo"
        max={180}
        min={50}
        onChange={(tempoBpm) => onChange({ tempoBpm })}
        step={1}
        suffix="BPM"
        symbolLatex={"\\bar{\\omega}"}
        symbolLabel="omega bar"
        value={config.tempoBpm}
      />
      <Slider
        label="Tempo spread"
        max={24}
        min={0}
        onChange={(tempoSpreadBpm) => onChange({ tempoSpreadBpm })}
        step={0.5}
        suffix="BPM"
        symbolLatex={"\\Delta\\omega"}
        symbolLabel="delta omega"
        value={config.tempoSpreadBpm}
      />
      <Slider
        label="Listening strength"
        max={3}
        min={0}
        onChange={(couplingStrength) => onChange({ couplingStrength })}
        step={0.05}
        symbolLatex={"K_{ij}"}
        symbolLabel="K i j"
        value={config.couplingStrength}
      />
      <Slider
        label="Latency"
        max={180}
        min={0}
        onChange={(latencyMs) => onChange({ latencySeconds: latencyMs / 1000 })}
        step={1}
        suffix="ms"
        symbolLatex={"\\tau_{ij}"}
        symbolLabel="tau i j"
        value={Math.round(config.latencySeconds * 1000)}
      />
      <Slider
        label="Jitter"
        max={60}
        min={0}
        onChange={(jitterMs) => onChange({ jitterSeconds: jitterMs / 1000 })}
        step={1}
        suffix="ms"
        symbolLatex={"\\sigma_{\\tau}"}
        symbolLabel="sigma tau"
        value={Math.round(config.jitterSeconds * 1000)}
      />
      <Slider
        label="Click strength"
        max={3}
        min={0}
        onChange={(clickTrackStrength) => onChange({ clickTrackStrength })}
        step={0.05}
        symbolLatex={"F_{\\mathrm{click}}"}
        symbolLabel="F click"
        value={config.clickTrackStrength}
      />
      <SegmentedControl
        label="Topology"
        onChange={(topology) => onChange({ topology })}
        options={topologyOptions}
        symbolLatex={"\\mathcal{G}_{K}"}
        symbolLabel="coupling graph"
        value={config.topology}
      />
      <SegmentedControl
        label="Texture"
        onChange={(repertoireTexture) => onChange({ repertoireTexture })}
        options={textureOptions}
        symbolLatex={"P(\\mathrm{texture})"}
        symbolLabel="texture profile"
        value={config.repertoireTexture}
      />
    </aside>
  );
}

type SliderProps = {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  suffix?: string;
  symbolLabel: string;
  symbolLatex: string;
  value: number;
};

function Slider({
  label,
  max,
  min,
  onChange,
  step,
  suffix,
  symbolLabel,
  symbolLatex,
  value,
}: SliderProps): ReactElement {
  return (
    <label className="slider-row">
      <span>
        <span className="control-name">
          {label}
          <MathText
            className="control-symbol"
            label={symbolLabel}
            latex={symbolLatex}
          />
        </span>
        <strong>
          {value}
          {suffix ? ` ${suffix}` : ""}
        </strong>
      </span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

type SegmentedControlProps<T extends Topology | RepertoireTexture> = {
  label: string;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  symbolLabel: string;
  symbolLatex: string;
  value: T;
};

function SegmentedControl<T extends Topology | RepertoireTexture>({
  label,
  onChange,
  options,
  symbolLabel,
  symbolLatex,
  value,
}: SegmentedControlProps<T>): ReactElement {
  return (
    <fieldset className="segmented">
      <legend>
        {label}
        <MathText
          className="control-symbol"
          label={symbolLabel}
          latex={symbolLatex}
        />
      </legend>
      <div>
        {options.map((option) => (
          <button
            className={option.value === value ? "active" : ""}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
