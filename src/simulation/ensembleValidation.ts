import type { CouplingEdge } from "./ensemble";
import { assertFiniteNonNegative } from "../numericValidation";

export { assertFiniteNonNegative, assertFinitePositive } from "../numericValidation";

export function assertValidCouplingEdges(
  edges: readonly CouplingEdge[],
  oscillatorCount: number,
): void {
  for (const edge of edges) {
    assertValidOscillatorIndex("edge.from", edge.from, oscillatorCount);
    assertValidOscillatorIndex("edge.to", edge.to, oscillatorCount);
    if (!Number.isFinite(edge.strength)) {
      throw new RangeError("edge.strength must be finite.");
    }
    assertFiniteNonNegative("edge.delaySeconds", edge.delaySeconds);
  }
}

function assertValidOscillatorIndex(name: string, value: number, oscillatorCount: number): void {
  if (!Number.isInteger(value) || value < 0 || value >= oscillatorCount) {
    throw new RangeError(`${name} must reference an existing oscillator.`);
  }
}
