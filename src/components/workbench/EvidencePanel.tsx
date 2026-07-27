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

      {records.length === 0 ? (
        <p className="mm-evidence-panel__empty">No claim boundary is registered for this lesson.</p>
      ) : (
        <ol className="mm-evidence-panel__claims">
          {records.map((claim) => (
            <li key={claim.id}>
              <article className="mm-evidence-claim">
                <div className="mm-evidence-claim__kind mm-claim-tag">{evidenceLabels[claim.kind]}</div>
                <h3>{claim.statement}</h3>
                <p><strong>Scope:</strong> {claim.scope}</p>
                <dl>
                  <div>
                    <dt>Allowed inference</dt>
                    <dd>{claim.allowedInference}</dd>
                  </div>
                  <div>
                    <dt>Do not infer</dt>
                    <dd>{claim.forbiddenInference}</dd>
                  </div>
                </dl>
                {claim.assumptions.length === 0 ? null : (
                  <details>
                    <summary>Assumptions ({claim.assumptions.length})</summary>
                    <ul>{claim.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
                  </details>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}

      <section className="mm-evidence-panel__sources" aria-labelledby={`${headingId}-sources`}>
        <h3 id={`${headingId}-sources`}>Source references</h3>
        {citedSourceIds.length === 0 ? (
          <p>No external source is required for the displayed definition or computation.</p>
        ) : (
          <ul>
            {citedSourceIds.map((sourceId) => {
              const source = sourceById(sourceId);
              return (
                <li key={sourceId}>
                  {source ? (
                    <>
                      <code>{sourceId}</code>{" · "}
                      <a href={source.url} rel="noreferrer" target="_blank">{source.title}</a>{" "}
                      <span>({source.authors}, {source.year})</span>
                      <small>{source.role}</small>
                    </>
                  ) : <code>{sourceId}</code>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
