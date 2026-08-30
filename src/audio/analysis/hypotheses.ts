/** Pure ranking of temporal and harmonic hypotheses. */
export type TempoHypothesis = Readonly<{
  bpm: number;
  confidence: number;
  lagFrames: number;
  label: "tempo hypothesis";
}>;

export type MeterHypothesis = Readonly<{
  beatsPerBar: number;
  confidence: number;
  label: "meter hypothesis";
}>;

export type ChordHypothesis = Readonly<{
  rootPitchClass: number | null;
  quality: "major" | "minor" | "no-chord";
  confidence: number;
  label: string;
}>;

type ScoredLag = Readonly<{ lag: number; score: number }>;
type ScoredChordCandidate = Readonly<{
  rootPitchClass: number | null;
  quality: ChordHypothesis["quality"];
  label: string;
  score: number;
}>;
type TempoOptions = Readonly<{ minimumBpm?: number; maximumBpm?: number; limit?: number }>;
type ValidatedTempoOptions = Readonly<{ minimumBpm: number; maximumBpm: number; limit: number }>;

function normalizeScores<T extends { score: number }>(items: readonly T[]): Array<T & { confidence: number }> {
  const positiveTotal = items.reduce((sum, item) => sum + Math.max(0, item.score), 0);
  return items.map((item) => ({
    ...item,
    confidence: positiveTotal > 0 ? Math.max(0, item.score) / positiveTotal : 0,
  }));
}

function isPositiveLocalPeak(scores: readonly ScoredLag[], candidate: ScoredLag, index: number): boolean {
  return [
    candidate.score > 0,
    candidate.score >= scoreAt(scores, index - 1),
    candidate.score >= scoreAt(scores, index + 1),
  ].every(Boolean);
}

const scoreAt = (scores: readonly ScoredLag[], index: number): number => scores.at(index)?.score ?? Number.NEGATIVE_INFINITY;

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function hasValidTempoTiming(sampleRateHz: number, hopSize: number): boolean {
  return isPositiveFinite(sampleRateHz) && isPositiveSafeInteger(hopSize);
}

function hasValidTempoBounds(minimumBpm: number, maximumBpm: number, limit: number): boolean {
  return minimumBpm > 0 && maximumBpm > minimumBpm && isPositiveSafeInteger(limit);
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function tempoLagBounds(
  fluxLength: number,
  sampleRateHz: number,
  hopSize: number,
  options: ValidatedTempoOptions,
): Readonly<{ minimumLag: number; maximumLag: number }> | null {
  const minimumLag = Math.max(1, Math.ceil((60 * sampleRateHz) / (options.maximumBpm * hopSize)));
  const maximumLag = Math.min(fluxLength - 2, Math.floor((60 * sampleRateHz) / (options.minimumBpm * hopSize)));
  return minimumLag <= maximumLag ? { minimumLag, maximumLag } : null;
}

const scoreTempoLag = (centeredFlux: readonly number[], lag: number): ScoredLag => {
  let numerator = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let index = lag; index < centeredFlux.length; index += 1) {
    const left = centeredFlux.at(index) ?? 0;
    const right = centeredFlux.at(index - lag) ?? 0;
    numerator += left * right;
    leftEnergy += left * left;
    rightEnergy += right * right;
  }
  const score = [leftEnergy > 0, rightEnergy > 0].every(Boolean)
    ? numerator / Math.sqrt(leftEnergy * rightEnergy)
    : 0;
  return { lag, score };
};

const rankTempoScores = (
  centeredFlux: readonly number[],
  bounds: Readonly<{ minimumLag: number; maximumLag: number }>,
  limit: number,
): ScoredLag[] => {
  const scores = Array.from(
    { length: bounds.maximumLag - bounds.minimumLag + 1 },
    (_, offset) => scoreTempoLag(centeredFlux, bounds.minimumLag + offset),
  );
  const peaks = scores.filter((candidate, index) => isPositiveLocalPeak(scores, candidate, index));
  const candidates = peaks.length > 0 ? peaks : scores.filter(({ score }) => score > 0);
  return candidates.sort((left, right) => right.score - left.score || left.lag - right.lag).slice(0, limit);
};

function validateTempoInputs(flux: readonly number[], sampleRateHz: number, hopSize: number, options: TempoOptions): ValidatedTempoOptions {
  if (!flux.every(isFiniteNonNegative)) {
    throw new RangeError("flux must contain finite non-negative values");
  }
  if (!hasValidTempoTiming(sampleRateHz, hopSize)) {
    throw new RangeError("sampleRateHz and hopSize must be positive");
  }
  const { minimumBpm, maximumBpm, limit } = resolveTempoOptions(options);
  if (!hasValidTempoBounds(minimumBpm, maximumBpm, limit)) {
    throw new RangeError("tempo bounds and limit must be positive and ordered");
  }
  return { minimumBpm, maximumBpm, limit };
}

const resolveTempoOptions = (options: TempoOptions): ValidatedTempoOptions => {
  return {
    minimumBpm: options.minimumBpm ?? 40,
    maximumBpm: options.maximumBpm ?? 240,
    limit: options.limit ?? 3,
  };
};

/** Ranks periodicities in a spectral-flux envelope; results remain hypotheses, not detected ground truth. */
export function rankTempoHypotheses(
  flux: readonly number[],
  sampleRateHz: number,
  hopSize: number,
  options: TempoOptions = {},
): TempoHypothesis[] {
  if (flux.length < 3) return [];
  const validatedOptions = validateTempoInputs(flux, sampleRateHz, hopSize, options);
  const mean = flux.reduce((sum, value) => sum + value, 0) / flux.length;
  const centered = flux.map((value) => value - mean);
  const bounds = tempoLagBounds(flux.length, sampleRateHz, hopSize, validatedOptions);
  if (bounds === null) return [];
  const ranked = rankTempoScores(centered, bounds, validatedOptions.limit);
  return normalizeScores(ranked).map(({ lag, confidence }) => Object.freeze({
    bpm: (60 * sampleRateHz) / (lag * hopSize),
    confidence,
    lagFrames: lag,
    label: "tempo hypothesis" as const,
  }));
}

/** Uses repeated beat-accent patterns to rank simple bar lengths. */
export function rankMeterHypotheses(
  beatStrengths: readonly number[],
  candidates: readonly number[] = [2, 3, 4, 6],
  limit = 3,
): MeterHypothesis[] {
  if (beatStrengths.length === 0) return [];
  validateMeterInputs(beatStrengths, candidates, limit);
  const scored = candidates.map((beatsPerBar) => scoreMeterCandidate(beatStrengths, beatsPerBar));
  return normalizeScores(scored)
    .sort((left, right) => right.confidence - left.confidence || left.beatsPerBar - right.beatsPerBar)
    .slice(0, limit)
    .map(({ beatsPerBar, confidence }) => Object.freeze({
      beatsPerBar,
      confidence,
      label: "meter hypothesis" as const,
    }));
}

function validateMeterInputs(beatStrengths: readonly number[], candidates: readonly number[], limit: number): void {
  if (!beatStrengths.every(isFiniteNonNegative)) {
    throw new RangeError("beatStrengths must contain finite non-negative values");
  }
  if (!isPositiveSafeInteger(limit) || candidates.length === 0) {
    throw new RangeError("limit and candidates must be non-empty positive integers");
  }
}

function scoreMeterCandidate(beatStrengths: readonly number[], beatsPerBar: number): Readonly<{ beatsPerBar: number; score: number }> {
  if (!Number.isSafeInteger(beatsPerBar) || beatsPerBar < 2) {
    throw new RangeError("meter candidates must contain integers of at least two beats");
  }
  return {
    beatsPerBar,
    score: repeatedBeatAgreement(beatStrengths, beatsPerBar) + accentContrast(beatStrengths, beatsPerBar),
  };
}

function repeatedBeatAgreement(beatStrengths: readonly number[], beatsPerBar: number): number {
  let agreement = 0;
  let comparisons = 0;
  for (let index = beatsPerBar; index < beatStrengths.length; index += 1) {
    const current = beatStrengths.at(index) ?? 0;
    const previous = beatStrengths.at(index - beatsPerBar) ?? 0;
    agreement += 1 - Math.min(1, Math.abs(current - previous) / Math.max(Math.abs(current), Math.abs(previous), 1e-9));
    comparisons += 1;
  }
  return comparisons > 0 ? agreement / comparisons : 0;
}

function accentContrast(beatStrengths: readonly number[], beatsPerBar: number): number {
  const downbeats = beatStrengths.filter((_, index) => index % beatsPerBar === 0);
  const otherBeats = beatStrengths.filter((_, index) => index % beatsPerBar !== 0);
  const downbeatMean = meanOrZero(downbeats);
  const otherMean = meanOrZero(otherBeats);
  return Math.max(0, (downbeatMean - otherMean) / Math.max(Math.abs(downbeatMean), 1e-9));
}

const meanOrZero = (values: readonly number[]): number => {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
};

const PITCH_CLASS_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"] as const;

function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return leftNorm > 0 && rightNorm > 0 ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

/** Returns ranked, deliberately coarse major/minor/no-chord hypotheses from a 12-bin chroma vector. */
export function rankChordHypotheses(chroma: ArrayLike<number>, limit = 3): ChordHypothesis[] {
  const chromaValues = validatedChroma(chroma);
  if (!isPositiveSafeInteger(limit)) throw new RangeError("limit must be a positive safe integer");
  const total = chromaValues.reduce((sum, value) => sum + value, 0);
  if (total === 0) return [noChordHypothesis()];
  const normalized = chromaValues.map((value) => value / total);
  const candidates = [...scoredChordCandidates(normalized), scoredNoChordCandidate(normalized)];
  return normalizeScores(candidates)
    .sort((left, right) => right.confidence - left.confidence || left.label.localeCompare(right.label))
    .slice(0, Math.min(limit, candidates.length))
    .map(({ rootPitchClass, quality, confidence, label }) => Object.freeze({ rootPitchClass, quality, confidence, label }));
}

function validatedChroma(chroma: ArrayLike<number>): number[] {
  const values = Array.from(chroma);
  if (values.length !== 12 || !values.every(isFiniteNonNegative)) {
    throw new RangeError("chroma must contain twelve finite non-negative values");
  }
  return values;
}

function noChordHypothesis(): ChordHypothesis {
  return Object.freeze({ rootPitchClass: null, quality: "no-chord", confidence: 1, label: "No chord" });
}

function scoredChordCandidates(chroma: readonly number[]): ScoredChordCandidate[] {
  return Array.from({ length: 12 }, (_, root) =>
    (["major", "minor"] as const).map((quality) => scoreChordCandidate(chroma, root, quality)),
  ).flat();
}

function scoreChordCandidate(
  chroma: readonly number[],
  rootPitchClass: number,
  quality: "major" | "minor",
): ScoredChordCandidate {
  return {
    rootPitchClass,
    quality,
    label: `${PITCH_CLASS_NAMES[rootPitchClass]} ${quality}`,
    score: cosineSimilarity(chroma, chordTemplate(rootPitchClass, quality)),
  };
}

function chordTemplate(rootPitchClass: number, quality: "major" | "minor"): number[] {
  const template = Array.from({ length: 12 }, () => 0.05);
  template[rootPitchClass] = 1;
  template[(rootPitchClass + (quality === "major" ? 4 : 3)) % 12] = 0.8;
  template[(rootPitchClass + 7) % 12] = 0.7;
  return template;
}

function scoredNoChordCandidate(chroma: readonly number[]): ScoredChordCandidate {
  const dispersion = Math.sqrt(chroma.reduce((sum, value) => sum + (value - 1 / 12) ** 2, 0));
  return {
    rootPitchClass: null,
    quality: "no-chord",
    label: "No chord",
    score: 1 - Math.min(1, dispersion * 2),
  };
}
