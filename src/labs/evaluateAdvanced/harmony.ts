import {
  intervalClassVector,
  invertPitchClasses,
  minimalVoiceLeading,
  shortestPath,
  transposePitchClasses,
} from "../harmony-geometry/model";
import {
  axes,
  booleanFactor,
  numberFactor,
  observable,
  result,
  signed,
  stringFactor,
  SYNTHETIC_PROVENANCE,
} from "../evaluationSupport";
import type { FactorValue, LabEvaluation } from "../types";

const pitchClassSets: Readonly<Record<string, readonly number[]>> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  quartal: [0, 5, 10],
  "whole-tone": [0, 2, 4, 6],
};

export function evaluatePitchClass(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
  const source = pitchClassSets[stringFactor(factors, "set")] ?? pitchClassSets.major;
  const axis = Math.round(numberFactor(factors, "axis"));
  const inverted = booleanFactor(factors, "invert");
  const transformed = inverted ? invertPitchClasses(source, axis) : transposePitchClasses(source, axis);
  const sourceVector = intervalClassVector(source);
  const transformedVector = intervalClassVector(transformed);
  const invariant = sourceVector.every((value, index) => value === transformedVector[index]);
  return result({
    headline: "Pitch-class transformation",
    result: `{${transformed.join(", ")}}`,
    observables: [
      observable({ id: "source", label: "Source set", value: `{${source.join(", ")}}`, unit: null, claimId: "math.identity" }),
      observable({ id: "transformed", label: "Transformed set", value: `{${transformed.join(", ")}}`, unit: null, claimId: "math.identity" }),
      observable({ id: "icv", label: "Interval-class vector", value: `<${transformedVector.join(",")}>`, unit: null, claimId: "math.identity" }),
      observable({ id: "invariant", label: "Vector invariant", value: invariant ? "yes" : "no", unit: null, claimId: "math.identity" }),
    ],
    trace: transformed.map((pitchClass) => ({ x: pitchClass, y: 1, series: inverted ? "Inverted set" : "Transposed set" })),
    visualKind: "phase",
    annotation: "Pitch-class invariance does not preserve register, voicing, tonal function, or expressive context.",
    traceAxes: axes("Pitch class", "mod 12", "Set membership", null),
  });
}

const chordPitchClasses: Readonly<Record<string, readonly number[]>> = {
  C: [0, 4, 7], G: [7, 11, 2], F: [5, 9, 0], Am: [9, 0, 4], Em: [4, 7, 11], Dm: [2, 5, 9],
};

const chordNames = ["C", "G", "F", "Am", "Em", "Dm"] as const;
const chordRootPitchClasses: Readonly<Record<(typeof chordNames)[number], number>> = {
  C: 0, G: 7, F: 5, Am: 9, Em: 4, Dm: 2,
};

function knownChordName(value: string, fallback: (typeof chordNames)[number]): (typeof chordNames)[number] {
  return chordNames.includes(value as (typeof chordNames)[number])
    ? value as (typeof chordNames)[number]
    : fallback;
}

function undirectedEdges(
  pairs: readonly Readonly<{ from: string; to: string; weight: number }>[],
): readonly Readonly<{ from: number; to: number; weight: number }>[] {
  return pairs.flatMap((pair) => {
    const from = chordNames.indexOf(pair.from as (typeof chordNames)[number]);
    const to = chordNames.indexOf(pair.to as (typeof chordNames)[number]);
    if (from < 0 || to < 0) throw new RangeError("Chord graph includes an unknown chord.");
    return [
      { from, to, weight: pair.weight },
      { from: to, to: from, weight: pair.weight },
    ];
  });
}

function graphEdges(graphFamily: string): readonly Readonly<{ from: number; to: number; weight: number }>[] {
  if (graphFamily === "tonnetz") {
    return undirectedEdges([
      { from: "C", to: "Am", weight: 1 },
      { from: "C", to: "Em", weight: 1 },
      { from: "G", to: "Em", weight: 1 },
      { from: "F", to: "Am", weight: 1 },
      { from: "F", to: "Dm", weight: 1 },
    ]);
  }

  const edges: { from: number; to: number; weight: number }[] = [];
  for (let from = 0; from < chordNames.length; from += 1) {
    for (let to = from + 1; to < chordNames.length; to += 1) {
      const difference = Math.abs(chordRootPitchClasses[chordNames[from]] - chordRootPitchClasses[chordNames[to]]);
      const weight = Math.min(difference, 12 - difference);
      edges.push({ from, to, weight }, { from: to, to: from, weight });
    }
  }
  return edges;
}

function graphPathCost(path: readonly number[], edges: readonly Readonly<{ from: number; to: number; weight: number }>[]): number {
  return path.slice(1).reduce((cost, node, index) => {
    const edge = edges.find((candidate) => candidate.from === path[index] && candidate.to === node);
    if (!edge) throw new RangeError("Shortest path contains a missing edge.");
    return cost + edge.weight;
  }, 0);
}

export function evaluateVoiceLeading(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
  const chordAName = knownChordName(stringFactor(factors, "chordA"), "C");
  const chordBName = knownChordName(stringFactor(factors, "chordB"), "Am");
  const chordA = chordPitchClasses[chordAName];
  const chordB = chordPitchClasses[chordBName];
  const graphFamily = stringFactor(factors, "metric");
  const voiceLeading = minimalVoiceLeading(chordA, chordB);
  const moves = voiceLeading.moves.map((move) => `${move.from}->${move.to} (${signed(move.semitones, 0)})`).join("; ");
  const graph = graphEdges(graphFamily);
  const graphPath = shortestPath(chordNames.length, graph, chordNames.indexOf(chordAName), chordNames.indexOf(chordBName));
  if (!graphPath) throw new RangeError("Selected graph does not connect the selected chords.");
  const graphPathNames = graphPath.map((node) => chordNames[node]);
  const graphCost = graphPathCost(graphPath, graph);
  return result({
    headline: "Minimum assignment",
    result: `${voiceLeading.distance} total semitones`,
    observables: [
      observable({ id: "distance", label: "Circular voice-leading distance", value: voiceLeading.distance, unit: "semitones", claimId: "model.deterministic", precision: 0 }),
      observable({ id: "moves", label: "Assigned moves", value: moves, unit: null, claimId: "model.deterministic" }),
      observable({ id: "graph", label: "Selected chord graph", value: graphFamily === "tonnetz" ? "P/L/R triadic graph" : "Chromatic root-distance graph", unit: null, claimId: "heuristic.transparent" }),
      observable({ id: "graphPath", label: "Shortest graph path", value: graphPathNames.join(" → "), unit: "chords", claimId: "model.deterministic" }),
      observable({ id: "graphCost", label: "Shortest graph-path cost", value: graphCost, unit: graphFamily === "tonnetz" ? "P/L/R transformations" : "root semitones", claimId: "model.deterministic", precision: 0 }),
    ],
    trace: [
      ...voiceLeading.moves.flatMap((move) => [
        { x: move.from, y: move.fromIndex, series: "Source voices" },
        { x: move.to, y: move.fromIndex, series: "Target voices" },
      ]),
      ...graphPath.map((node, index) => ({ x: index, y: chordRootPitchClasses[chordNames[node]], series: "Shortest graph path (root pitch class)" })),
    ],
    visualKind: "network",
    annotation: "The graph path is defined only over the six displayed triads; equal-sized pitch-class assignments omit register, doubling, fingering, orchestration, and tonal syntax.",
    traceAxes: axes("Pitch class or graph step", "mod 12 / steps", "Voice index or root pitch class", "index / mod 12"),
  });
}

function chordScores(root: number, quality: string, ambiguity: number): readonly { label: string; score: number }[] {
  const names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const intended = `${names[root]} ${quality}`;
  const alternatives = [
    { label: intended, score: Math.max(0.2, 1 - 0.55 * ambiguity) },
    { label: `${names[(root + (quality === "major" ? 9 : 3)) % 12]} ${quality === "major" ? "minor" : "major"}`, score: 0.22 + 0.45 * ambiguity },
    { label: ambiguity > 0.65 ? "no chord" : `${names[(root + 7) % 12]} major`, score: 0.12 + 0.35 * ambiguity },
  ];
  return alternatives.sort((left, right) => right.score - left.score);
}

export function evaluateChordHypotheses(factors: Readonly<Record<string, FactorValue>>): LabEvaluation {
  const root = Math.round(numberFactor(factors, "root"));
  const quality = stringFactor(factors, "quality");
  const ambiguity = numberFactor(factors, "ambiguity");
  const ranked = chordScores(root, quality, ambiguity);
  return result({
    headline: "Ranked chord hypotheses",
    result: `${ranked[0].label} (${ranked[0].score.toFixed(2)})`,
    observables: ranked.map((candidate, index) => observable({
      id: `chord${index + 1}`,
      label: `Hypothesis ${index + 1}`,
      value: `${candidate.label} · ${candidate.score.toFixed(2)}`,
      unit: null,
      claimId: "hypothesis.transcription",
    })),
    trace: ranked.map((candidate, index) => ({ x: index + 1, y: candidate.score, series: candidate.label })),
    visualKind: "spectrum",
    annotation: "The top three are template-similarity hypotheses. They do not encode inversion, function, voicing, or a full score.",
    traceAxes: axes("Hypothesis rank", null, "Template similarity", null),
    provenance: SYNTHETIC_PROVENANCE,
  });
}
