import { assertFiniteNonNegative } from "../../numericValidation";

export type RandomSource = () => number;

function assertProbability(value: number, name: string, allowZero: boolean): void {
  if (!Number.isFinite(value) || value > 1 || (allowZero ? value < 0 : value <= 0)) {
    throw new RangeError(`${name} must be ${allowZero ? "between 0 and 1" : "greater than 0 and at most 1"}.`);
  }
}

function assertDistribution(probabilities: readonly number[], name: string): void {
  if (probabilities.length === 0) throw new RangeError(`${name} must not be empty.`);
  probabilities.forEach((probability, index) => {
    assertProbability(probability, `${name}[${index}]`, true);
  });
  const total = probabilities.reduce((sum, probability) => sum + probability, 0);
  if (Math.abs(total - 1) > 1e-12) throw new RangeError(`${name} must sum to 1.`);
}

/** Creates a reproducible Mulberry32 pseudo-random source from a 32-bit seed. */
export function createSeededRandom(seed: number): RandomSource {
  if (!Number.isInteger(seed)) throw new RangeError("seed must be an integer.");
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normalizes each non-negative transition row independently. */
export function normalizeTransitionMatrix(matrix: readonly (readonly number[])[]): number[][] {
  if (matrix.length === 0) throw new RangeError("matrix must not be empty.");
  return matrix.map((row, rowIndex) => {
    if (row.length !== matrix.length) throw new RangeError("matrix must be square.");
    row.forEach((value, columnIndex) => {
      assertFiniteNonNegative(`matrix[${rowIndex}][${columnIndex}]`, value);
    });
    const total = row.reduce((sum, value) => sum + value, 0);
    if (total === 0) throw new RangeError(`matrix row ${rowIndex} must have positive total weight.`);
    return row.map((value) => value / total);
  });
}

function draw(distribution: readonly number[], random: RandomSource): number {
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError("random source must return a finite value in [0, 1).");
  }
  let cumulative = 0;
  for (let index = 0; index < distribution.length; index += 1) {
    cumulative += distribution[index];
    if (sample < cumulative || index === distribution.length - 1) return index;
  }
  return distribution.length - 1;
}

/** Returns a sequence containing the initial state followed by sampled transitions. */
export function generateMarkovSequence(
  matrix: readonly (readonly number[])[],
  initialState: number,
  length: number,
  random: RandomSource,
): number[] {
  const normalized = normalizeTransitionMatrix(matrix);
  if (!Number.isInteger(initialState) || initialState < 0 || initialState >= normalized.length) {
    throw new RangeError("initialState must identify a matrix state.");
  }
  if (!Number.isInteger(length) || length < 1) throw new RangeError("length must be a positive integer.");
  const sequence = [initialState];
  while (sequence.length < length) {
    const currentState = sequence[sequence.length - 1];
    sequence.push(draw(normalized[currentState], random));
  }
  return sequence;
}

/** Approximates the stationary distribution by repeated row-vector multiplication. */
export function stationaryDistribution(
  matrix: readonly (readonly number[])[],
  tolerance: number = 1e-10,
  maxIterations: number = 10_000,
): number[] {
  const normalized = normalizeTransitionMatrix(matrix);
  if (!Number.isFinite(tolerance) || tolerance <= 0) throw new RangeError("tolerance must be positive.");
  if (!Number.isInteger(maxIterations) || maxIterations < 1) throw new RangeError("maxIterations must be a positive integer.");
  let current = Array<number>(normalized.length).fill(1 / normalized.length);
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const next = normalized.map((_, target) =>
      current.reduce((sum, probability, source) => sum + probability * normalized[source][target], 0),
    );
    const difference = next.reduce((sum, probability, index) => sum + Math.abs(probability - current[index]), 0);
    if (difference <= tolerance) return next;
    current = next;
  }
  throw new RangeError("Stationary distribution did not converge within maxIterations.");
}

/** Shannon entropy in bits. */
export function entropy(probabilities: readonly number[]): number {
  assertDistribution(probabilities, "probabilities");
  const result = -probabilities.reduce(
    (sum, probability) => sum + (probability === 0 ? 0 : probability * Math.log2(probability)),
    0,
  );
  return result === 0 ? 0 : result;
}

/** Information content of an event in bits. */
export function surprisal(probability: number): number {
  assertProbability(probability, "probability", false);
  return -Math.log2(probability);
}
