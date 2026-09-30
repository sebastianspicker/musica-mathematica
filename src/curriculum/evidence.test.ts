import { describe, expect, it } from "vitest";
import { claims, evidenceClaimIdsFor } from "./evidence";

describe("evidenceClaimIdsFor", () => {
  it("has exactly the two result-dependent claims among the current claims", () => {
    expect(claims.filter((claim) => claim.kind === "measured-observation" || claim.kind === "transcription-hypothesis").map((claim) => claim.id))
      .toEqual(["measurement.local", "hypothesis.transcription"]);
  });

  it("hides result-dependent claims that the evaluation did not produce", () => {
    const lessonClaims = ["measurement.local", "hypothesis.transcription", "literature.context", "recommendation.inquiry"];
    expect(evidenceClaimIdsFor(lessonClaims, ["model.deterministic"]))
      .toEqual(["literature.context", "recommendation.inquiry", "model.deterministic"]);
  });

  it("shows result-dependent claims that the evaluation produced, without duplicates", () => {
    const lessonClaims = ["measurement.local", "hypothesis.transcription", "literature.context"];
    expect(evidenceClaimIdsFor(lessonClaims, ["measurement.local", "measurement.local", "hypothesis.transcription"]))
      .toEqual(["measurement.local", "hypothesis.transcription", "literature.context"]);
  });

  it("keeps contextual claims in lesson order ahead of result-only claims", () => {
    expect(evidenceClaimIdsFor(["math.identity", "heuristic.transparent"], ["model.ensemble", "math.identity"]))
      .toEqual(["math.identity", "heuristic.transparent", "model.ensemble"]);
  });
});
