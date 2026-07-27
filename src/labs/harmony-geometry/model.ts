export type PitchClass = number;

export type VoiceLeadingMove = {
  fromIndex: number;
  toIndex: number;
  from: PitchClass;
  to: PitchClass;
  semitones: number;
};

export type VoiceLeading = {
  moves: readonly VoiceLeadingMove[];
  distance: number;
};

export type WeightedEdge = {
  from: number;
  to: number;
  weight: number;
};

function assertInteger(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${name} must be an integer.`);
  }
}

function assertPitchClasses(pitchClasses: readonly number[], name: string): void {
  if (pitchClasses.length === 0) {
    throw new RangeError(`${name} must not be empty.`);
  }
  pitchClasses.forEach((pitchClass, index) => assertInteger(pitchClass, `${name}[${index}]`));
}

/** Converts any integer pitch spelling to its pitch class in [0, 11]. */
export function normalizePitchClass(pitchClass: number): PitchClass {
  assertInteger(pitchClass, "pitchClass");
  return ((pitchClass % 12) + 12) % 12;
}

export function transposePitchClasses(
  pitchClasses: readonly number[],
  semitones: number,
): PitchClass[] {
  assertPitchClasses(pitchClasses, "pitchClasses");
  assertInteger(semitones, "semitones");
  return pitchClasses.map((pitchClass) => normalizePitchClass(pitchClass + semitones));
}

/** Applies the standard pitch-class inversion I_n(x) = n - x (mod 12). */
export function invertPitchClasses(
  pitchClasses: readonly number[],
  index: number = 0,
): PitchClass[] {
  assertPitchClasses(pitchClasses, "pitchClasses");
  assertInteger(index, "index");
  return pitchClasses.map((pitchClass) => normalizePitchClass(index - pitchClass));
}

/** Counts unordered pitch-class pairs by interval class 1 through 6. */
export function intervalClassVector(pitchClasses: readonly number[]): readonly number[] {
  assertPitchClasses(pitchClasses, "pitchClasses");
  const normalized = pitchClasses.map(normalizePitchClass);
  const vector = [0, 0, 0, 0, 0, 0];

  for (let left = 0; left < normalized.length; left += 1) {
    for (let right = left + 1; right < normalized.length; right += 1) {
      const distance = Math.abs(normalized[left] - normalized[right]);
      const intervalClass = Math.min(distance, 12 - distance);
      if (intervalClass > 0) {
        vector[intervalClass - 1] += 1;
      }
    }
  }

  return vector;
}

function signedShortestInterval(from: PitchClass, to: PitchClass): number {
  const upward = normalizePitchClass(to - from);
  return upward > 6 ? upward - 12 : upward;
}

/**
 * Finds the minimum total circular semitone movement between equal-sized chords.
 * Equal-cost assignments retain the first lexical target ordering.
 */
export function minimalVoiceLeading(
  fromPitchClasses: readonly number[],
  toPitchClasses: readonly number[],
): VoiceLeading {
  assertPitchClasses(fromPitchClasses, "fromPitchClasses");
  assertPitchClasses(toPitchClasses, "toPitchClasses");
  if (fromPitchClasses.length !== toPitchClasses.length) {
    throw new RangeError("Voice-leading chords must contain the same number of pitch classes.");
  }

  const from = fromPitchClasses.map(normalizePitchClass);
  const to = toPitchClasses.map(normalizePitchClass);
  let bestMoves: VoiceLeadingMove[] | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  function assign(fromIndex: number, usedTargets: readonly boolean[], moves: readonly VoiceLeadingMove[], distance: number): void {
    if (distance >= bestDistance) return;
    if (fromIndex === from.length) {
      bestDistance = distance;
      bestMoves = [...moves];
      return;
    }

    for (let toIndex = 0; toIndex < to.length; toIndex += 1) {
      if (usedTargets[toIndex]) continue;
      const semitones = signedShortestInterval(from[fromIndex], to[toIndex]);
      const nextUsed = [...usedTargets];
      nextUsed[toIndex] = true;
      assign(
        fromIndex + 1,
        nextUsed,
        [...moves, { fromIndex, toIndex, from: from[fromIndex], to: to[toIndex], semitones }],
        distance + Math.abs(semitones),
      );
    }
  }

  assign(0, Array<boolean>(to.length).fill(false), [], 0);
  return { moves: bestMoves ?? [], distance: bestDistance };
}

function assertGraphNode(name: string, node: number, nodeCount: number): void {
  assertInteger(node, name);
  if (node < 0 || node >= nodeCount) {
    throw new RangeError(`${name} must identify an existing node.`);
  }
}

function graphNeighbors(nodeCount: number, edges: readonly WeightedEdge[]): WeightedEdge[][] {
  const neighbors = Array.from({ length: nodeCount }, () => [] as WeightedEdge[]);
  for (const edge of edges) {
    assertGraphNode("edge.from", edge.from, nodeCount);
    assertGraphNode("edge.to", edge.to, nodeCount);
    if (!Number.isFinite(edge.weight) || edge.weight < 0) {
      throw new RangeError("edge.weight must be a finite non-negative number.");
    }
    neighbors[edge.from].push(edge);
  }
  return neighbors;
}

function nearestUnvisited(unvisited: ReadonlySet<number>, distances: readonly number[]): number {
  const first = unvisited.values().next().value;
  if (first === undefined) throw new RangeError("unvisited must not be empty.");
  let nearest = first;
  for (const node of unvisited) {
    if (distances[node] < distances[nearest]) nearest = node;
  }
  return nearest;
}

function relaxNeighbors(
  current: number,
  neighbors: readonly WeightedEdge[],
  unvisited: ReadonlySet<number>,
  distances: number[],
  previous: Array<number | undefined>,
): void {
  for (const edge of neighbors) {
    if (!unvisited.has(edge.to)) continue;
    const candidate = distances[current] + edge.weight;
    if (candidate < distances[edge.to]) {
      distances[edge.to] = candidate;
      previous[edge.to] = current;
    }
  }
}

function pathFromPrevious(end: number, previous: readonly (number | undefined)[]): number[] {
  const path: number[] = [];
  for (let node: number | undefined = end; node !== undefined; node = previous[node]) {
    path.unshift(node);
  }
  return path;
}

/** Dijkstra shortest path for non-negative weighted, numbered-node graphs. */
export function shortestPath(
  nodeCount: number,
  edges: readonly WeightedEdge[],
  start: number,
  end: number,
): readonly number[] | null {
  assertInteger(nodeCount, "nodeCount");
  if (nodeCount <= 0) throw new RangeError("nodeCount must be positive.");
  assertGraphNode("start", start, nodeCount);
  assertGraphNode("end", end, nodeCount);
  const neighbors = graphNeighbors(nodeCount, edges);

  const distances = Array<number>(nodeCount).fill(Number.POSITIVE_INFINITY);
  const previous = Array<number | undefined>(nodeCount).fill(undefined);
  const unvisited = new Set(Array.from({ length: nodeCount }, (_, index) => index));
  distances[start] = 0;

  while (unvisited.size > 0) {
    const current = nearestUnvisited(unvisited, distances);
    if (distances[current] === Number.POSITIVE_INFINITY || current === end) break;
    unvisited.delete(current);
    relaxNeighbors(current, neighbors[current], unvisited, distances, previous);
  }

  if (distances[end] === Number.POSITIVE_INFINITY) return null;
  return pathFromPrevious(end, previous);
}
