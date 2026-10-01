import { describe, expect, it } from "vitest";
import { claimById, claims, researchSources, sourceById } from "./evidence";
// Static import: a missing fixture fails collection instead of being silently skipped.
import committedGolden from "./__golden__/evaluations.json";

type Identified = Readonly<{ id: string }>;

function duplicateIds(records: readonly Identified[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) duplicates.add(record.id);
    seen.add(record.id);
  }
  return [...duplicates].sort();
}

// The registry checks the claims and sources that lessons reference; these tests cover
// every claim and every claim that evaluator output can cite.
describe("evidence identifier uniqueness", () => {
  it("keeps source and claim identifiers unique", () => {
    expect(duplicateIds(claims)).toEqual([]);
    expect(duplicateIds(researchSources)).toEqual([]);
  });
});

describe("evidence reference resolution", () => {
  it("resolves every source cited by every claim", () => {
    for (const claim of claims) {
      for (const sourceId of claim.sourceIds) expect(sourceById(sourceId), `${claim.id} -> ${sourceId}`).toBeDefined();
    }
  });

  it("resolves every claim cited by the committed golden observables", () => {
    const fixture: Readonly<Record<string, Readonly<{ observables: readonly Readonly<{ claimId: string }>[] }>>> = committedGolden;
    const cited = Object.values(fixture).flatMap((evaluation) => evaluation.observables.map((observable) => observable.claimId));

    expect(cited.length).toBeGreaterThan(0);
    for (const claimId of cited) expect(claimById(claimId), claimId).toBeDefined();
  });
});
