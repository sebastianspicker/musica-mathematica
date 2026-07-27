import { assertPositiveInteger } from "../../numericValidation";

export type RhythmAnalysis = Readonly<{
  pulseCount: number;
  density: number;
  autocorrelation: readonly number[];
  spectrum: readonly Readonly<{ bin: number; real: number; imaginary: number; magnitude: number }>[];
}>;

export type MeterCandidate = Readonly<{
  beats: number;
  subdivisionsPerBeat: number;
  score: number;
}>;

function assertPattern(pattern: readonly number[]): void {
  if (pattern.length === 0) {
    throw new RangeError("pattern must not be empty");
  }
  if (!pattern.every((value) => value === 0 || value === 1)) {
    throw new RangeError("pattern must contain only 0 and 1 values");
  }
}

/** Evenly distributes `pulses` binary onsets over `steps`, starting with an onset. */
export function euclideanRhythm(pulses: number, steps: number): number[] {
  assertPositiveInteger("steps", steps);
  if (!Number.isSafeInteger(pulses) || pulses < 0 || pulses > steps) {
    throw new RangeError("pulses must be a safe integer between zero and steps");
  }
  return Array.from({ length: steps }, (_, index) => (index * pulses) % steps < pulses ? 1 : 0);
}

/** Cyclically rotates a sequence; positive values rotate onsets to later indices. */
export function rotateRhythm(pattern: readonly number[], steps: number): number[] {
  assertPattern(pattern);
  if (!Number.isSafeInteger(steps)) {
    throw new RangeError("steps must be a safe integer");
  }
  const offset = ((steps % pattern.length) + pattern.length) % pattern.length;
  return pattern.map((_, index) => pattern[(index - offset + pattern.length) % pattern.length]);
}

/** Circular binary-onset overlap for every non-negative lag. */
export function circularAutocorrelation(pattern: readonly number[]): number[] {
  assertPattern(pattern);
  return pattern.map((_, lag) =>
    pattern.reduce((sum, value, index) => sum + value * pattern[(index + lag) % pattern.length], 0),
  );
}

/** Direct DFT representation suitable for display or further deterministic analysis. */
export function rhythmSpectrum(pattern: readonly number[]): RhythmAnalysis["spectrum"] {
  assertPattern(pattern);
  const size = pattern.length;
  return Array.from({ length: size }, (_, bin) => {
    const { real, imaginary } = pattern.reduce(
      (sum, value, index) => {
        const angle = (-2 * Math.PI * bin * index) / size;
        return { real: sum.real + value * Math.cos(angle), imaginary: sum.imaginary + value * Math.sin(angle) };
      },
      { real: 0, imaginary: 0 },
    );
    return { bin, real, imaginary, magnitude: Math.hypot(real, imaginary) };
  });
}

export function analyzeRhythm(pattern: readonly number[]): RhythmAnalysis {
  assertPattern(pattern);
  const pulseCount = pattern.reduce((sum, value) => sum + value, 0);
  return {
    pulseCount,
    density: pulseCount / pattern.length,
    autocorrelation: circularAutocorrelation(pattern),
    spectrum: rhythmSpectrum(pattern),
  };
}

/** Scores candidate equal subdivisions only from onset alignment; it does not infer a performed meter. */
export function rankMeterCandidates(
  pattern: readonly number[],
  allowedBeats: readonly number[] = [2, 3, 4, 5, 6, 7],
): MeterCandidate[] {
  assertPattern(pattern);
  if (allowedBeats.length === 0) {
    throw new RangeError("allowedBeats must not be empty");
  }
  const candidates = allowedBeats.flatMap((beats) => {
    assertPositiveInteger("beats", beats);
    if (pattern.length % beats !== 0) {
      return [];
    }
    const subdivisionsPerBeat = pattern.length / beats;
    const alignedOnsets = pattern.reduce((sum, value, index) => sum + (index % subdivisionsPerBeat === 0 ? value : 0), 0);
    return [{ beats, subdivisionsPerBeat, score: alignedOnsets / Math.max(1, pattern.reduce((sum, value) => sum + value, 0)) }];
  });
  return candidates.sort((left, right) => right.score - left.score || left.beats - right.beats);
}
