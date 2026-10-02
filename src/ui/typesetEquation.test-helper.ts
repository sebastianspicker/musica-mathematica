import type { EquationPart } from "./typesetEquation";

/** A TeX-like reading of typeset parts, for assertions. */
export function flattenEquation(parts: readonly EquationPart[]): string {
  return parts.map((part) => {
    if (!("parts" in part)) return part.kind === "sep" ? (part.text === " " ? " " : "; ") : part.kind === "bin" || part.kind === "rel" ? ` ${part.text} ` : part.text;
    const inner = flattenEquation(part.parts);
    return part.kind === "sub" ? `_{${inner}}` : part.kind === "sup" ? `^{${inner}}` : `√{${inner}}`;
  }).join("");
}
