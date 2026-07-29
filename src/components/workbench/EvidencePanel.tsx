import { useId, type ReactElement } from "react";
import { claimsByIds, evidenceLabels } from "../../learning/evidence";
import { sourceById } from "../../learning/sources";

export type EvidencePanelProps = Readonly<{
  claimIds: readonly string[];
  sourceIds: readonly string[];
}>;

export function EvidencePanel({ claimIds, sourceIds }: EvidencePanelProps): ReactElement {
  const headingId = useId();
  const records = claimsByIds(claimIds);
  const citedSourceIds = unique([
    ...sourceIds,
    ...records.flatMap((claim) => claim.sourceIds),
  ]);

  return (
    <aside className="mm-evidence-panel" aria-labelledby={headingId}>
      <div className="mm-evidence-panel__heading">
        <h2 id={headingId}>Evidence &amp; inference</h2>
        <span>{records.length} claim boundaries</span>
      </div>

      <ClaimsList records={records} />
      <SourceReferences headingId={headingId} sourceIds={citedSourceIds} />
    </aside>
  );
}

function ClaimsList({ records }: Readonly<{ records: ReturnType<typeof claimsByIds> }>): ReactElement {
  if (records.length === 0) return <p className="mm-evidence-panel__empty">No claim boundary is registered for this lesson.</p>;
  return <ol className="mm-evidence-panel__claims">{records.map((claim) => <ClaimRecord key={claim.id} claim={claim} />)}</ol>;
}

function ClaimRecord({ claim }: Readonly<{ claim: ReturnType<typeof claimsByIds>[number] }>): ReactElement {
  return <li><article className="mm-evidence-claim">
    <div className="mm-evidence-claim__kind mm-claim-tag">{evidenceLabels[claim.kind]}</div>
    <h3>{claim.statement}</h3>
    <p><strong>Scope:</strong> {claim.scope}</p>
    <dl><div><dt>Allowed inference</dt><dd>{claim.allowedInference}</dd></div><div><dt>Do not infer</dt><dd>{claim.forbiddenInference}</dd></div></dl>
    {claim.assumptions.length === 0 ? null : <details><summary>Assumptions ({claim.assumptions.length})</summary><ul>{claim.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></details>}
  </article></li>;
}

function SourceReferences({ headingId, sourceIds }: Readonly<{ headingId: string; sourceIds: readonly string[] }>): ReactElement {
  return <section className="mm-evidence-panel__sources" aria-labelledby={`${headingId}-sources`}>
    <h3 id={`${headingId}-sources`}>Source references</h3>
    {sourceIds.length === 0 ? <p>No external source is required for the displayed definition or computation.</p> : <ul>{sourceIds.map((sourceId) => <SourceReference key={sourceId} sourceId={sourceId} />)}</ul>}
  </section>;
}

function SourceReference({ sourceId }: Readonly<{ sourceId: string }>): ReactElement {
  const source = sourceById(sourceId);
  if (!source) return <li><code>{sourceId}</code></li>;
  return <li><code>{sourceId}</code>{" · "}<a href={source.url} rel="noreferrer" target="_blank">{source.title}</a>{" "}<span>({source.authors}, {source.year})</span><small>{source.role}</small></li>;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
