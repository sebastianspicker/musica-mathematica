import {
  assertNonNegativeFinite,
  assertPositiveFinite,
  assertPositiveInteger,
} from "../../numericValidation";

export type IdealMode = Readonly<{
  modeNumber: number;
  frequencyHz: number;
  wavelengthMeters: number;
}>;

export type AdditivePartial = Readonly<{
  partialNumber: number;
  frequencyHz: number;
  amplitude: number;
}>;

export type FourierResolution = Readonly<{
  sampleRateHz: number;
  frameSize: number;
  nyquistHz: number;
  binWidthHz: number;
  frameDurationSeconds: number;
  hopDurationSeconds: number;
}>;

export type TimbreTrajectoryPoint = Readonly<{
  timeSeconds: number;
  amplitude: number;
  rolloffExponent: number;
  spectralCentroidHz: number;
}>;

/** Ideal fixed-string modes. Real instruments add stiffness, damping, radiation, and geometry. */
export function idealStringModes(
  lengthMeters: number,
  waveSpeedMetersPerSecond: number,
  modeCount: number,
): IdealMode[] {
  assertPositiveFinite("lengthMeters", lengthMeters);
  assertPositiveFinite("waveSpeedMetersPerSecond", waveSpeedMetersPerSecond);
  assertPositiveInteger("modeCount", modeCount);
  return Array.from({ length: modeCount }, (_, index) => {
    const modeNumber = index + 1;
    return Object.freeze({
      modeNumber,
      frequencyHz: (modeNumber * waveSpeedMetersPerSecond) / (2 * lengthMeters),
      wavelengthMeters: (2 * lengthMeters) / modeNumber,
    });
  });
}

/** A normalized harmonic spectrum with amplitudes proportional to 1 / n^rolloffExponent. */
export function additivePartials(
  fundamentalHz: number,
  partialCount: number,
  rolloffExponent = 1,
): AdditivePartial[] {
  assertPositiveFinite("fundamentalHz", fundamentalHz);
  assertPositiveInteger("partialCount", partialCount);
  assertNonNegativeFinite("rolloffExponent", rolloffExponent);
  const raw = Array.from({ length: partialCount }, (_, index) => {
    const partialNumber = index + 1;
    return {
      partialNumber,
      frequencyHz: fundamentalHz * partialNumber,
      amplitude: 1 / partialNumber ** rolloffExponent,
    };
  });
  const total = raw.reduce((sum, partial) => sum + partial.amplitude, 0);
  return raw.map((partial) => Object.freeze({ ...partial, amplitude: partial.amplitude / total }));
}

/** One normalized sample of the declared additive model. */
export function additiveWaveSample(timeSeconds: number, partials: readonly AdditivePartial[]): number {
  if (!Number.isFinite(timeSeconds)) throw new RangeError("timeSeconds must be finite");
  if (partials.length === 0) throw new RangeError("partials must not be empty");
  let sample = 0;
  let amplitudeTotal = 0;
  for (const partial of partials) {
    assertPositiveFinite("partial.frequencyHz", partial.frequencyHz);
    assertNonNegativeFinite("partial.amplitude", partial.amplitude);
    sample += partial.amplitude * Math.sin(2 * Math.PI * partial.frequencyHz * timeSeconds);
    amplitudeTotal += partial.amplitude;
  }
  return amplitudeTotal > 0 ? sample / amplitudeTotal : 0;
}

/** Folds a sinusoid into the non-negative principal alias below Nyquist. */
export function aliasFrequencyHz(frequencyHz: number, sampleRateHz: number): number {
  assertNonNegativeFinite("frequencyHz", frequencyHz);
  assertPositiveFinite("sampleRateHz", sampleRateHz);
  const halfRate = sampleRateHz / 2;
  const signed = ((frequencyHz + halfRate) % sampleRateHz + sampleRateHz) % sampleRateHz - halfRate;
  return Math.abs(signed);
}

export function fourierResolution(
  sampleRateHz: number,
  frameSize: number,
  overlapRatio = 0.5,
): FourierResolution {
  assertPositiveFinite("sampleRateHz", sampleRateHz);
  assertPositiveInteger("frameSize", frameSize);
  if (!Number.isFinite(overlapRatio) || overlapRatio < 0 || overlapRatio >= 1) {
    throw new RangeError("overlapRatio must be at least zero and less than one");
  }
  return Object.freeze({
    sampleRateHz,
    frameSize,
    nyquistHz: sampleRateHz / 2,
    binWidthHz: sampleRateHz / frameSize,
    frameDurationSeconds: frameSize / sampleRateHz,
    hopDurationSeconds: (frameSize * (1 - overlapRatio)) / sampleRateHz,
  });
}

/** Piecewise-linear attack and decay envelope used only for the synthetic lesson model. */
export function attackDecayEnvelope(
  timeSeconds: number,
  attackSeconds: number,
  decaySeconds: number,
): number {
  assertNonNegativeFinite("timeSeconds", timeSeconds);
  assertPositiveFinite("attackSeconds", attackSeconds);
  assertPositiveFinite("decaySeconds", decaySeconds);
  if (timeSeconds <= attackSeconds) return timeSeconds / attackSeconds;
  if (timeSeconds >= attackSeconds + decaySeconds) return 0;
  return 1 - (timeSeconds - attackSeconds) / decaySeconds;
}

export type TimbreTrajectoryOptions = Readonly<{
  fundamentalHz: number;
  partialCount: number;
  durationSeconds: number;
  pointCount: number;
  attackSeconds: number;
  decaySeconds: number;
  brightnessModulationHz: number;
  brightnessModulationDepth: number;
  baseRolloffExponent?: number;
}>;

/**
 * Transparent centroid proxy for a time-varying additive spectrum. It is a
 * computed model trajectory, not a measurement of an instrument.
 */
export function timeVaryingTimbreTrajectory(options: TimbreTrajectoryOptions): TimbreTrajectoryPoint[] {
  assertPositiveFinite("fundamentalHz", options.fundamentalHz);
  assertPositiveInteger("partialCount", options.partialCount);
  assertPositiveFinite("durationSeconds", options.durationSeconds);
  assertPositiveInteger("pointCount", options.pointCount);
  assertPositiveFinite("attackSeconds", options.attackSeconds);
  assertPositiveFinite("decaySeconds", options.decaySeconds);
  assertNonNegativeFinite("brightnessModulationHz", options.brightnessModulationHz);
  if (!Number.isFinite(options.brightnessModulationDepth)
      || options.brightnessModulationDepth < 0
      || options.brightnessModulationDepth > 1) {
    throw new RangeError("brightnessModulationDepth must be between zero and one");
  }
  const baseRolloffExponent = options.baseRolloffExponent ?? 1.25;
  assertPositiveFinite("baseRolloffExponent", baseRolloffExponent);

  return Array.from({ length: options.pointCount }, (_, index) => {
    const timeSeconds = options.pointCount === 1
      ? 0
      : (index * options.durationSeconds) / (options.pointCount - 1);
    const modulation = Math.sin(2 * Math.PI * options.brightnessModulationHz * timeSeconds);
    const rolloffExponent = Math.max(
      0.05,
      baseRolloffExponent * (1 - options.brightnessModulationDepth * modulation),
    );
    const partials = additivePartials(options.fundamentalHz, options.partialCount, rolloffExponent);
    const spectralCentroidHz = partials.reduce(
      (sum, partial) => sum + partial.frequencyHz * partial.amplitude,
      0,
    );
    return Object.freeze({
      timeSeconds,
      amplitude: attackDecayEnvelope(timeSeconds, options.attackSeconds, options.decaySeconds),
      rolloffExponent,
      spectralCentroidHz,
    });
  });
}
