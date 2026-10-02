import type { ReactElement, ReactNode } from "react";
import { typesetEquation, type EquationPart } from "./typesetEquation";

/** A typeset equation. Assistive technology receives the curriculum's source text. */
export function Equation({ source }: Readonly<{ source: string }>): ReactElement {
  return <span className="mm-equation" role="math" aria-label={source}>
    <span aria-hidden="true">{renderParts(typesetEquation(source))}</span>
  </span>;
}

function renderParts(parts: readonly EquationPart[]): ReactNode[] {
  return parts.map((part, index) => {
    if ("parts" in part) {
      if (part.kind === "sqrt") return <span className="mm-equation__sqrt" key={index}>√<span>{renderParts(part.parts)}</span></span>;
      const Tag = part.kind;
      return <Tag key={index}>{renderParts(part.parts)}</Tag>;
    }
    if (part.kind === "sep") return part.text === ";" ? <span className="mm-equation__sep" key={index}>;</span> : " ";
    return <span className={`mm-equation__${part.kind}`} key={index}>{part.text}</span>;
  });
}
