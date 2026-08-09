import type { Spectrum } from "./spectrum";
import { assertNonEmptyFiniteNumbers } from "../numericValidation";

export type PitchEstimate = Readonly<{
  frequencyHz: number | null;
  confidence: number;
  periodSamples: number | null;
}>;

type PitchOptions = Readonly<{ minimumHz: number; maximumHz: number; threshold: number }>;
type PitchOptionsInput = Readonly<{ minimumHz?: number; maximumHz?: number; threshold?: number }>;

export { detectFluxOnsets, spectralFlux } from "./flux";

export type LevelFeatures = Readonly<{
  rms: number;
  dbfs: number;
  peak: number;
  clippedSampleRatio: number;
  silent: boolean;
}>;

export type WaveformEnvelopePoint = Readonly<{
  startSample: number;
  endSampleExclusive: number;
  minimum: number;
  maximum: number;
  rms: number;
}>;

export function rootMeanSquare(samples: ArrayLike<number>): number {
  assertNonEmptyFiniteNumbers(samples, "samples");
  let sumSquares = 0;
  for (let index = 0; index < samples.length; index += 1) {
    sumSquares += samples[index] * samples[index];
  }
  return Math.sqrt(sumSquares / samples.length);
}

export function amplitudeToDbfs(amplitude: number): number {
  if (!Number.isFinite(amplitude) || amplitude < 0) {
    throw new RangeError("amplitude must be non-negative and finite");
  }
  return amplitude === 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(amplitude);
}

export function analyzeLevel(samples: ArrayLike<number>, silenceThresholdDbfs = -60): LevelFeatures {
  const rms = rootMeanSquare(samples);
  let peak = 0;
  let clippedSamples = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const absolute = Math.abs(samples[index]);
    peak = Math.max(peak, absolute);
    if (absolute >= 0.999) clippedSamples += 1;
  }
  const dbfs = amplitudeToDbfs(rms);
  return Object.freeze({
    rms,
    dbfs,
    peak,
    clippedSampleRatio: clippedSamples / samples.length,
    silent: dbfs < silenceThresholdDbfs,
  });
}

/** Bounded min/max/RMS waveform representation; it never retains the input PCM. */
export function waveformEnvelope(
  samples: ArrayLike<number>,
  maximumPointCount = 256,
): WaveformEnvelopePoint[] {
  assertNonEmptyFiniteNumbers(samples, "samples");
  if (!Number.isSafeInteger(maximumPointCount) || maximumPointCount <= 0) {
    throw new RangeError("maximumPointCount must be a positive safe integer");
  }
  const blockSize = Math.ceil(samples.length / maximumPointCount);
  const points: WaveformEnvelopePoint[] = [];
  for (let startSample = 0; startSample < samples.length; startSample += blockSize) {
    const endSampleExclusive = Math.min(samples.length, startSample + blockSize);
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;
    let sumSquares = 0;
    for (let index = startSample; index < endSampleExclusive; index += 1) {
      const value = samples[index];
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
      sumSquares += value * value;
    }
    points.push(Object.freeze({
      startSample,
      endSampleExclusive,
      minimum,
      maximum,
      rms: Math.sqrt(sumSquares / (endSampleExclusive - startSample)),
    }));
  }
  return points;
}

/** Low-percentile block RMS estimate in dBFS; descriptive and uncalibrated. */
export function estimateNoiseFloorDbfs(
  samples: ArrayLike<number>,
  blockSize = 256,
  percentile = 0.1,
): number {
  assertNonEmptyFiniteNumbers(samples, "samples");
  if (![Number.isSafeInteger(blockSize), blockSize > 0].every(Boolean)) {
    throw new RangeError("blockSize must be a positive safe integer");
  }
  if (![Number.isFinite(percentile), percentile >= 0, percentile <= 1].every(Boolean)) {
    throw new RangeError("percentile must be between zero and one");
  }
  const levels: number[] = [];
  for (let start = 0; start < samples.length; start += blockSize) {
    const end = Math.min(samples.length, start + blockSize);
    levels.push(blockRmsDbfs(samples, start, end));
  }
  levels.sort((left, right) => left - right);
  return levels[Math.round((levels.length - 1) * percentile)];
}

const blockRmsDbfs = (samples: ArrayLike<number>, start: number, end: number): number => {
  let sumSquares = 0;
  for (let index = start; index < end; index += 1) sumSquares += samples[index] * samples[index];
  return amplitudeToDbfs(Math.sqrt(sumSquares / (end - start)));
};

function weightedFrequencyMean(spectrum: Spectrum, weights: ArrayLike<number>): number {
  let weightedSum = 0;
  let total = 0;
  for (let bin = 0; bin < weights.length; bin += 1) {
    weightedSum += spectrum.frequenciesHz[bin] * weights[bin];
    total += weights[bin];
  }
  return total > 0 ? weightedSum / total : 0;
}

export function spectralCentroidHz(spectrum: Spectrum): number {
  return weightedFrequencyMean(spectrum, spectrum.magnitudes);
}

export function spectralFlatness(spectrum: Spectrum): number {
  if (spectrum.powers.length === 0) return 0;
  const positive = Array.from(spectrum.powers, (power) => Math.max(power, Number.EPSILON));
  const arithmeticMean = positive.reduce((sum, power) => sum + power, 0) / positive.length;
  if (arithmeticMean <= Number.EPSILON) return 0;
  const geometricMean = Math.exp(positive.reduce((sum, power) => sum + Math.log(power), 0) / positive.length);
  return Math.min(1, geometricMean / arithmeticMean);
}

export function spectralRolloffHz(spectrum: Spectrum, fraction = 0.85): number {
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) {
    throw new RangeError("fraction must be greater than zero and at most one");
  }
  const totalPower = Array.from(spectrum.powers).reduce((sum, power) => sum + power, 0);
  if (totalPower === 0) return 0;
  const target = totalPower * fraction;
  let cumulative = 0;
  for (let bin = 0; bin < spectrum.powers.length; bin += 1) {
    cumulative += spectrum.powers[bin];
    if (cumulative >= target) return spectrum.frequenciesHz[bin];
  }
  return spectrum.frequenciesHz[spectrum.frequenciesHz.length - 1];
}

/** Ratio of spectral power near integer multiples of an estimated fundamental. */
export function spectralHarmonicity(
  spectrum: Spectrum,
  fundamentalHz: number | null,
  toleranceCents = 35,
): number {
  if (fundamentalHz === null) return 0;
  if (!isPositiveFinite(fundamentalHz)) return 0;
  assertPositiveFinite(toleranceCents, "toleranceCents");
  let harmonicPower = 0;
  let eligiblePower = 0;
  for (let bin = 1; bin < spectrum.powers.length; bin += 1) {
    const frequency = spectrum.frequenciesHz[bin];
    const power = spectrum.powers[bin];
    if (frequency < fundamentalHz * 0.5) continue;
    eligiblePower += power;
    if (isNearHarmonic(frequency, fundamentalHz, toleranceCents)) harmonicPower += power;
  }
  return eligiblePower > 0 ? harmonicPower / eligiblePower : 0;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

const isNearHarmonic = (frequencyHz: number, fundamentalHz: number, toleranceCents: number): boolean => {
  const harmonic = Math.max(1, Math.round(frequencyHz / fundamentalHz));
  const expectedHz = fundamentalHz * harmonic;
  return Math.abs(1200 * Math.log2(frequencyHz / expectedHz)) <= toleranceCents;
};

export function chromaFromSpectrum(spectrum: Spectrum, minimumFrequencyHz = 40): Float64Array {
  const chroma = new Float64Array(12);
  for (let bin = 1; bin < spectrum.powers.length; bin += 1) {
    const frequency = spectrum.frequenciesHz[bin];
    if (frequency < minimumFrequencyHz || spectrum.powers[bin] <= 0) continue;
    const midi = 69 + 12 * Math.log2(frequency / 440);
    const pitchClass = ((Math.round(midi) % 12) + 12) % 12;
    chroma[pitchClass] += spectrum.powers[bin];
  }
  const total = Array.from(chroma).reduce((sum, value) => sum + value, 0);
  if (total > 0) {
    for (let pitchClass = 0; pitchClass < chroma.length; pitchClass += 1) chroma[pitchClass] /= total;
  }
  return chroma;
}

/** Monophonic YIN estimate. A null frequency explicitly represents insufficient periodic evidence. */
export function estimatePitchYin(
  samples: ArrayLike<number>,
  sampleRateHz: number,
  options: PitchOptionsInput = {},
): PitchEstimate {
  assertNonEmptyFiniteNumbers(samples, "samples");
  const { minimumHz, maximumHz, threshold } = validatePitchOptions(sampleRateHz, options);
  const minimumPeriod = Math.max(2, Math.floor(sampleRateHz / maximumHz));
  const maximumPeriod = Math.min(Math.floor(sampleRateHz / minimumHz), Math.floor(samples.length / 2));
  if (maximumPeriod <= minimumPeriod) return noPitchEstimate();

  const normalized = cumulativeMeanNormalizedDifference(samples, maximumPeriod);
  const candidate = findYinCandidate(normalized, minimumPeriod, maximumPeriod, threshold);
  if (candidate === null) return noPitchEstimate();
  const refinedPeriod = refineYinPeriod(normalized, minimumPeriod, maximumPeriod, candidate);
  const current = normalizedAt(normalized, candidate);
  return Object.freeze({
    frequencyHz: sampleRateHz / refinedPeriod,
    confidence: Math.max(0, Math.min(1, 1 - current)),
    periodSamples: refinedPeriod,
  });
}

const validatePitchOptions = (
  sampleRateHz: number,
  options: PitchOptionsInput,
): PitchOptions => {
  assertPositiveFinite(sampleRateHz, "sampleRateHz");
  const minimumHz = options.minimumHz ?? 50;
  const maximumHz = options.maximumHz ?? 1200;
  const threshold = options.threshold ?? 0.12;
  if (!isValidPitchRange(minimumHz, maximumHz, sampleRateHz)) {
    throw new RangeError("pitch range must be positive, ordered, and below Nyquist");
  }
  return { minimumHz, maximumHz, threshold };
};

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite`);
}

const isValidPitchRange = (minimumHz: number, maximumHz: number, sampleRateHz: number): boolean => [
  minimumHz > 0,
  maximumHz > minimumHz,
  maximumHz < sampleRateHz / 2,
].every(Boolean);

const cumulativeMeanNormalizedDifference = (samples: ArrayLike<number>, maximumPeriod: number): Float64Array => {
  const normalized = [1];
  let runningSum = 0;
  for (let period = 1; period <= maximumPeriod; period += 1) {
    let difference = 0;
    for (let index = 0; index < samples.length - period; index += 1) {
      const delta = samples[index] - samples[index + period];
      difference += delta * delta;
    }
    runningSum += difference;
    normalized.push(runningSum === 0 ? 1 : (difference * period) / runningSum);
  }
  return Float64Array.from(normalized);
};

const normalizedAt = (normalized: Float64Array, index: number): number => normalized.at(index) ?? 1;

const findYinCandidate = (
  normalized: Float64Array,
  minimumPeriod: number,
  maximumPeriod: number,
  threshold: number,
): number | null => {
  for (let period = minimumPeriod; period <= maximumPeriod; period += 1) {
    if (normalizedAt(normalized, period) >= threshold) continue;
    let candidate = period;
    while (
      candidate < maximumPeriod
      && normalizedAt(normalized, candidate + 1) < normalizedAt(normalized, candidate)
    ) candidate += 1;
    return candidate;
  }
  return null;
};

const refineYinPeriod = (
  normalized: Float64Array,
  minimumPeriod: number,
  maximumPeriod: number,
  candidate: number,
): number => {
  const previous = normalizedAt(normalized, Math.max(minimumPeriod, candidate - 1));
  const current = normalizedAt(normalized, candidate);
  const next = normalizedAt(normalized, Math.min(maximumPeriod, candidate + 1));
  const denominator = 2 * (2 * current - previous - next);
  return denominator === 0 ? candidate : candidate + (next - previous) / denominator;
};

const noPitchEstimate = (): PitchEstimate => {
  return Object.freeze({ frequencyHz: null, confidence: 0, periodSamples: null });
};
