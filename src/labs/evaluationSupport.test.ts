import { describe, expect, it } from "vitest";
import {
  MODEL_PROVENANCE,
  SYNTHETIC_PROVENANCE,
  axes,
  booleanFactor,
  numberFactor,
  observable,
  observableValues,
  result,
  resultValues,
  signed,
  stringFactor,
} from "./evaluationSupport";

describe("lab evaluation support", () => {
  it("creates observables with model defaults and caller overrides", () => {
    expect(observable({ id: "tempo", label: "Tempo", value: 120, unit: "BPM" })).toEqual({
      id: "tempo",
      label: "Tempo",
      value: 120,
      unit: "BPM",
      claimId: "model.deterministic",
      precision: 2,
      aggregation: "instantaneous",
    });
    expect(observable({
      id: "spread",
      label: "Tempo spread",
      value: "narrow",
      unit: null,
      claimId: "measurement.local",
      precision: 0,
      aggregation: "range",
    })).toEqual({
      id: "spread",
      label: "Tempo spread",
      value: "narrow",
      unit: null,
      claimId: "measurement.local",
      precision: 0,
      aggregation: "range",
    });
  });

  it("keeps positional observable construction equivalent to object construction", () => {
    const expected = observable({
      id: "onsets",
      label: "Onsets",
      value: 4,
      unit: "events",
      claimId: "hypothesis.transcription",
      precision: 1,
      aggregation: "distribution",
    });

    expect(observableValues(
      "onsets",
      "Onsets",
      4,
      "events",
      "hypothesis.transcription",
      1,
      "distribution",
    )).toEqual(expected);
  });

  it("uses model provenance by default and preserves a caller-provided provenance", () => {
    const input = {
      headline: "Phase relationship",
      result: "Aligned",
      observables: [observable({ id: "phase", label: "Phase", value: 0, unit: "cycles" })],
      trace: [{ x: 0, y: 0, series: "phase" }],
      visualKind: "phase" as const,
      annotation: "Deterministic model output.",
      traceAxes: axes("Time", "s", "Phase", "cycles"),
    };
    const provenance = {
      source: "synthetic" as const,
      calibration: "uncalibrated" as const,
      method: "Synthetic fixture",
      sampleRateHz: 48_000,
    };

    expect(result(input).provenance).toBe(MODEL_PROVENANCE);
    expect(result({ ...input, provenance }).provenance).toBe(provenance);
  });

  it("keeps positional result construction equivalent to object construction", () => {
    const observables = [observable({ id: "energy", label: "Energy", value: 0.5, unit: null })];
    const trace = [{ x: 1, y: 0.5, series: "energy" }];
    const traceAxes = axes("Time", "s", "Energy", null);
    const provenance = { ...SYNTHETIC_PROVENANCE, droppedFrames: 2 };
    const input = {
      headline: "Energy trace",
      result: "Stable",
      observables,
      trace,
      visualKind: "spectrum" as const,
      annotation: "Synthetic result.",
      traceAxes,
      provenance,
    };

    expect(resultValues(
      input.headline,
      input.result,
      input.observables,
      input.trace,
      input.visualKind,
      input.annotation,
      input.traceAxes,
      input.provenance,
    )).toEqual(result(input));
  });

  it("creates labelled trace axes", () => {
    expect(axes("Frequency", "Hz", "Magnitude", null)).toEqual({
      x: { label: "Frequency", unit: "Hz" },
      y: { label: "Magnitude", unit: null },
    });
  });

  it("returns correctly typed factor values and rejects invalid values with exact errors", () => {
    const factors = { tempo: 120, mode: "dorian", enabled: true };

    expect(numberFactor(factors, "tempo")).toBe(120);
    expect(stringFactor(factors, "mode")).toBe("dorian");
    expect(booleanFactor(factors, "enabled")).toBe(true);
    expect(() => numberFactor({ tempo: Number.NaN }, "tempo")).toThrowError(
      new RangeError("Factor tempo must be a finite number."),
    );
    expect(() => numberFactor({ tempo: "120" }, "tempo")).toThrowError(
      new RangeError("Factor tempo must be a finite number."),
    );
    expect(() => stringFactor({ mode: false }, "mode")).toThrowError(
      new TypeError("Factor mode must be a string."),
    );
    expect(() => booleanFactor({ enabled: 1 }, "enabled")).toThrowError(
      new TypeError("Factor enabled must be a boolean."),
    );
  });

  it("formats signed values and exposes fixed model and synthetic provenance", () => {
    expect(signed(2.345, 2)).toBe("+2.35");
    expect(signed(-2.345, 2)).toBe("-2.35");
    expect(signed(0, 0)).toBe("+0");
    expect(MODEL_PROVENANCE).toEqual({
      source: "model",
      calibration: "uncalibrated",
      method: "Deterministic browser model; no audio measurement",
    });
    expect(SYNTHETIC_PROVENANCE).toEqual({
      source: "synthetic",
      calibration: "uncalibrated",
      method: "Deterministic synthetic fixture; no raw audio retained",
    });
  });
});
