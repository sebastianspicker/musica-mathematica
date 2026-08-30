/* eslint-disable no-restricted-imports -- This test intentionally checks the curriculum/evidence boundary. */
import { describe, expect, it } from "vitest";
import { curriculumCatalog } from "./catalog";
import { claims } from "../learning/evidence/claims";
import { researchSources } from "../learning/evidence/sources";

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

function missingIds(references: readonly string[], records: readonly Identified[]): string[] {
  const availableIds = new Set(records.map((record) => record.id));
  return [...new Set(references.filter((id) => !availableIds.has(id)))].sort();
}

describe("curriculum and evidence referential integrity", () => {
  it("keeps source and claim identifiers unique and resolvable", () => {
    const lessons = curriculumCatalog.flatMap((domain) => domain.lessons);
    const lessonClaimIds = lessons.flatMap((lesson) => lesson.claimIds);
    const lessonSourceIds = lessons.flatMap((lesson) => lesson.sourceIds);
    const claimSourceIds = claims.flatMap((claim) => claim.sourceIds);

    expect(duplicateIds(claims)).toEqual([]);
    expect(duplicateIds(researchSources)).toEqual([]);
    expect(missingIds(lessonClaimIds, claims)).toEqual([]);
    expect(missingIds(lessonSourceIds, researchSources)).toEqual([]);
    expect(missingIds(claimSourceIds, researchSources)).toEqual([]);
  });
});
