import { describe, expect, it } from "vitest";
import { claimKinds } from "../labs/types";
import { claimById, claims, claimsByIds, evidenceLabels } from "./evidence";

describe("learning evidence", () => {
  it("labels every published claim kind", () => {
    expect(Object.keys(evidenceLabels).sort()).toEqual([...claimKinds].sort());
    expect(Object.values(evidenceLabels).every((label) => label.trim().length > 0)).toBe(true);
  });

  it("publishes unique, structurally complete claims with explicit inference bounds", () => {
    expect(new Set(claims.map((claim) => claim.id)).size).toBe(claims.length);

    for (const claim of claims) {
      expect(claim.id.trim()).not.toBe("");
      expect(claimKinds).toContain(claim.kind);
      expect(claim.statement.trim()).not.toBe("");
      expect(claim.scope.trim()).not.toBe("");
      expect(claim.assumptions.every((assumption) => assumption.trim().length > 0)).toBe(true);
      expect(claim.sourceIds.every((sourceId) => sourceId.trim().length > 0)).toBe(true);
      expect(claim.allowedInference.trim()).not.toBe("");
      expect(claim.forbiddenInference.trim()).not.toBe("");
    }
  });

  it("looks up known claim IDs and omits unknown IDs", () => {
    const knownClaim = claims[0];

    expect(claimById(knownClaim.id)).toBe(knownClaim);
    expect(claimById("unknown.claim")).toBeUndefined();
  });

  it("preserves requested claim order and duplicates while dropping unknown IDs", () => {
    const first = claims[0];
    const last = claims.at(-1);
    if (!last) throw new Error("Expected published claims.");

    expect(claimsByIds([last.id, "unknown.claim", first.id, last.id])).toEqual([last, first, last]);
  });
});
