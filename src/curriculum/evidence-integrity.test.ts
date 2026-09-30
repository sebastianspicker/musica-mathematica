import { describe, expect, it } from "vitest";
import { claims, researchSources } from "./evidence";

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

// Reference resolution is enforced at runtime by createCurriculumRegistry when the
// catalog composes it with the evidence; only identifier uniqueness remains here.
describe("evidence identifier uniqueness", () => {
  it("keeps source and claim identifiers unique", () => {
    expect(duplicateIds(claims)).toEqual([]);
    expect(duplicateIds(researchSources)).toEqual([]);
  });
});
