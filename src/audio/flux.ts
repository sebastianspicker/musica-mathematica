type FluxOnsetOptions = Readonly<{
  neighborhood?: number;
  sensitivity?: number;
}>;

type ValidatedFluxOnsetOptions = Readonly<{
  neighborhood: number;
  sensitivity: number;
}>;

export function assertSpectralMagnitude(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("spectral magnitudes must be finite and non-negative");
  }
}

export function assertComparableSpectra(
  currentMagnitudes: ArrayLike<number>,
  previousMagnitudes: ArrayLike<number>,
): void {
  if (currentMagnitudes.length !== previousMagnitudes.length || currentMagnitudes.length === 0) {
    throw new RangeError("current and previous spectra must have the same non-zero length");
  }
  for (let bin = 0; bin < currentMagnitudes.length; bin += 1) {
    assertSpectralMagnitude(currentMagnitudes[bin]);
    assertSpectralMagnitude(previousMagnitudes[bin]);
  }
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function assertFluxTiming(sampleRateHz: number, hopSize: number): void {
  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0 || !Number.isSafeInteger(hopSize) || hopSize <= 0) {
    throw new RangeError("sampleRateHz and hopSize must be positive");
  }
}

export function validatedFluxOnsetOptions(options: FluxOnsetOptions): ValidatedFluxOnsetOptions {
  const neighborhood = options.neighborhood ?? 8;
  const sensitivity = options.sensitivity ?? 1.5;
  if (!Number.isSafeInteger(neighborhood) || neighborhood < 1 || sensitivity < 0) {
    throw new RangeError("neighborhood must be a positive integer and sensitivity must be non-negative");
  }
  return { neighborhood, sensitivity };
}

export function isFluxOnset(
  flux: readonly number[],
  index: number,
  neighborhood: number,
  sensitivity: number,
): boolean {
  const local = flux.slice(Math.max(0, index - neighborhood), Math.min(flux.length, index + neighborhood + 1));
  const center = median(local);
  const deviation = median(local.map((value) => Math.abs(value - center)));
  const threshold = center + sensitivity * Math.max(deviation, Number.EPSILON);
  return flux[index] > threshold && flux[index] >= flux[index - 1] && flux[index] > flux[index + 1];
}

export function spectralFlux(
  currentMagnitudes: ArrayLike<number>,
  previousMagnitudes: ArrayLike<number>,
): number {
  assertComparableSpectra(currentMagnitudes, previousMagnitudes);
  let positiveChange = 0;
  let normalization = 0;
  for (let bin = 0; bin < currentMagnitudes.length; bin += 1) {
    const current = currentMagnitudes[bin];
    const previous = previousMagnitudes[bin];
    positiveChange += Math.max(0, current - previous);
    normalization += Math.abs(current);
  }
  return normalization > 0 ? positiveChange / normalization : 0;
}

export function detectFluxOnsets(
  flux: readonly number[],
  sampleRateHz: number,
  hopSize: number,
  options: FluxOnsetOptions = {},
): number[] {
  assertFluxTiming(sampleRateHz, hopSize);
  const validatedOptions = validatedFluxOnsetOptions(options);
  const onsets: number[] = [];
  for (let index = 1; index < flux.length - 1; index += 1) {
    if (isFluxOnset(
      flux,
      index,
      validatedOptions.neighborhood,
      validatedOptions.sensitivity,
    )) {
      onsets.push((index * hopSize) / sampleRateHz);
    }
  }
  return onsets;
}
