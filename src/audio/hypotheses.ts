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

function normalizeScores<T extends { score: number }>(items: readonly T[]): Array<T & { confidence: number }> {
  const positiveTotal = items.reduce((sum, item) => sum + Math.max(0, item.score), 0);
  return items.map((item) => ({
    ...item,
    confidence: positiveTotal > 0 ? Math.max(0, item.score) / positiveTotal : 0,
  }));
}

/** Ranks periodicities in a spectral-flux envelope; results remain hypotheses, not detected ground truth. */
export function rankTempoHypotheses(
  flux: readonly number[],
  sampleRateHz: number,
  hopSize: number,
  options: Readonly<{ minimumBpm?: number; maximumBpm?: number; limit?: number }> = {},
): TempoHypothesis[] {
  if (flux.length < 3) return [];
  if (flux.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError("flux must contain finite non-negative values");
  }
  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0 || !Number.isSafeInteger(hopSize) || hopSize <= 0) {
    throw new RangeError("sampleRateHz and hopSize must be positive");
  }
  const minimumBpm = options.minimumBpm ?? 40;
  const maximumBpm = options.maximumBpm ?? 240;
  const limit = options.limit ?? 3;
  if (!(minimumBpm > 0 && maximumBpm > minimumBpm) || !Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError("tempo bounds and limit must be positive and ordered");
  }
  const mean = flux.reduce((sum, value) => sum + value, 0) / flux.length;
  const centered = flux.map((value) => value - mean);
  const minimumLag = Math.max(1, Math.ceil((60 * sampleRateHz) / (maximumBpm * hopSize)));
  const maximumLag = Math.min(flux.length - 2, Math.floor((60 * sampleRateHz) / (minimumBpm * hopSize)));
  if (maximumLag < minimumLag) return [];

  const scores = Array.from({ length: maximumLag - minimumLag + 1 }, (_, offset) => {
    const lag = minimumLag + offset;
    let numerator = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let index = lag; index < centered.length; index += 1) {
      numerator += centered[index] * centered[index - lag];
      leftEnergy += centered[index] * centered[index];
      rightEnergy += centered[index - lag] * centered[index - lag];
    }
    const score = leftEnergy > 0 && rightEnergy > 0 ? numerator / Math.sqrt(leftEnergy * rightEnergy) : 0;
    return { lag, score };
  });
  const peaks = scores.filter((candidate, index) => {
    const previous = scores[index - 1]?.score ?? Number.NEGATIVE_INFINITY;
    const next = scores[index + 1]?.score ?? Number.NEGATIVE_INFINITY;
    return candidate.score > 0 && candidate.score >= previous && candidate.score >= next;
  });
  const pool = peaks.length > 0 ? peaks : scores.filter(({ score }) => score > 0);
  const ranked = pool.sort((left, right) => right.score - left.score || left.lag - right.lag).slice(0, limit);
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
  if (beatStrengths.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError("beatStrengths must contain finite non-negative values");
  }
  if (!Number.isSafeInteger(limit) || limit <= 0 || candidates.length === 0) {
    throw new RangeError("limit and candidates must be non-empty positive integers");
  }
  const scored = candidates.map((beatsPerBar) => {
    if (!Number.isSafeInteger(beatsPerBar) || beatsPerBar < 2) {
      throw new RangeError("meter candidates must contain integers of at least two beats");
    }
    let agreement = 0;
    let comparisons = 0;
    for (let index = beatsPerBar; index < beatStrengths.length; index += 1) {
      const current = beatStrengths[index];
      const previous = beatStrengths[index - beatsPerBar];
      agreement += 1 - Math.min(1, Math.abs(current - previous) / Math.max(Math.abs(current), Math.abs(previous), 1e-9));
      comparisons += 1;
    }
    const downbeats = beatStrengths.filter((_, index) => index % beatsPerBar === 0);
    const otherBeats = beatStrengths.filter((_, index) => index % beatsPerBar !== 0);
    const downbeatMean = downbeats.reduce((sum, value) => sum + value, 0) / Math.max(1, downbeats.length);
    const otherMean = otherBeats.reduce((sum, value) => sum + value, 0) / Math.max(1, otherBeats.length);
    const accentContrast = Math.max(0, (downbeatMean - otherMean) / Math.max(Math.abs(downbeatMean), 1e-9));
    return { beatsPerBar, score: (comparisons > 0 ? agreement / comparisons : 0) + accentContrast };
  });
  return normalizeScores(scored)
    .sort((left, right) => right.confidence - left.confidence || left.beatsPerBar - right.beatsPerBar)
    .slice(0, limit)
    .map(({ beatsPerBar, confidence }) => Object.freeze({
      beatsPerBar,
      confidence,
      label: "meter hypothesis" as const,
    }));
}

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
  const chromaValues = Array.from(chroma);
  if (chromaValues.length !== 12 || chromaValues.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError("chroma must contain twelve finite non-negative values");
  }
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new RangeError("limit must be a positive safe integer");
  const total = chromaValues.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return [Object.freeze({ rootPitchClass: null, quality: "no-chord", confidence: 1, label: "No chord" })];
  }
  const normalized = chromaValues.map((value) => value / total);
  const candidates: Array<{ rootPitchClass: number | null; quality: ChordHypothesis["quality"]; label: string; score: number }> = [];
  for (let root = 0; root < 12; root += 1) {
    for (const quality of ["major", "minor"] as const) {
      const template = Array.from({ length: 12 }, () => 0.05);
      template[root] = 1;
      template[(root + (quality === "major" ? 4 : 3)) % 12] = 0.8;
      template[(root + 7) % 12] = 0.7;
      candidates.push({
        rootPitchClass: root,
        quality,
        label: `${PITCH_CLASS_NAMES[root]} ${quality}`,
        score: cosineSimilarity(normalized, template),
      });
    }
  }
  const uniformity = 1 - Math.min(1, Math.sqrt(normalized.reduce((sum, value) => sum + (value - 1 / 12) ** 2, 0)) * 2);
  candidates.push({ rootPitchClass: null, quality: "no-chord", label: "No chord", score: uniformity });
  return normalizeScores(candidates)
    .sort((left, right) => right.confidence - left.confidence || left.label.localeCompare(right.label))
    .slice(0, Math.min(limit, candidates.length))
    .map(({ rootPitchClass, quality, confidence, label }) => Object.freeze({ rootPitchClass, quality, confidence, label }));
}
