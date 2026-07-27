import type { ReactElement } from "react";
import { claimsByIds, evidenceLabels } from "../../learning/evidence";
import { sourceById } from "../../learning/sources";
import { InterfaceIcon } from "../InterfaceIcon";

export type EvidenceRailProps = Readonly<{
  claimIds: readonly string[];
  sourceIds: readonly string[];
}>;

export function EvidenceRail({ claimIds, sourceIds }: EvidenceRailProps): ReactElement {
  const claims = claimsByIds(claimIds);
  const primaryClaim = claims.find((claim) => claim.kind === "computed-model-result") ?? claims[0];
  const source = sourceById(sourceIds[0]);

  return <aside className="mm-evidence-rail" aria-label="Current evidence boundary">
    <div className="mm-evidence-rail__item mm-evidence-rail__item--model"><InterfaceIcon name="function" /><strong>{primaryClaim ? evidenceLabels[primaryClaim.kind] : "Model result"}</strong></div>
    <div className="mm-evidence-rail__item mm-evidence-rail__item--allowed"><InterfaceIcon name="check" /><strong>Allowed</strong><p>{primaryClaim?.allowedInference ?? "Compare the displayed result within its stated scope."}</p></div>
    <div className="mm-evidence-rail__item mm-evidence-rail__item--forbidden"><InterfaceIcon name="warning" /><strong>Do not infer</strong><p>{primaryClaim?.forbiddenInference ?? "Performance quality or calibrated measurement."}</p></div>
    <div className="mm-evidence-rail__item mm-evidence-rail__item--source"><InterfaceIcon name="source" /><strong>Source</strong><p>{source ? shortSource(source.authors, source.year) : "Published equation and documented method"}</p></div>
  </aside>;
}

function shortSource(authors: string, year: number): string {
  return `${authors.replace(" and colleagues", "")} ${year}`;
}
