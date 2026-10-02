/**
 * Typesets the curriculum's plain-text equations ("f_n/f_0 = 2^(n/m)") as
 * structured parts: italic variables, roman words, real sub- and superscripts,
 * Greek letters, and proper operators. Unknown syntax degrades to plain text.
 */
export type EquationPart =
  | Readonly<{ kind: "var" | "word" | "num" | "op" | "bin" | "rel" | "sep"; text: string }>
  | Readonly<{ kind: "sub" | "sup" | "sqrt"; parts: readonly EquationPart[] }>;

const greek = new Map([
  ["alpha", "α"], ["beta", "β"], ["delta", "δ"], ["Delta", "Δ"], ["mu", "μ"], ["omega", "ω"], ["Omega", "Ω"],
  ["phi", "φ"], ["pi", "π"], ["sigma", "σ"], ["tau", "τ"], ["theta", "θ"],
]);
const uprightGreek = new Set(["Delta", "Omega"]);
const relations = new Map([["=", "="], ["<", "<"], [">", ">"], ["~", "∼"], ["+/-", "±"], ["in", "∈"], ["iff", "iff"]]);
const operators = new Map([["-", "−"], ["+", "+"], ["/", "/"], ["|", "|"], ["(", "("], [")", ")"], ["[", "["], ["]", "]"], [",", ","], ["*", "·"]]);
/** Two-letter products and differentials that read as separate italic symbols. */
const splitWords = new Map([["dt", ["d", "t"]], ["ik", ["i", "k"]], ["pq", ["p", "q"]]]);

export function typesetEquation(source: string): readonly EquationPart[] {
  const parser = new Parser(source);
  const parts = parser.sequence(false);
  return tidy(parts);
}

class Parser {
  private index = 0;
  constructor(private readonly source: string) {}

  sequence(inGroup: boolean): EquationPart[] {
    const parts: EquationPart[] = [];
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (inGroup && char === ")") return parts;
      if (char === " ") { this.index += 1; parts.push({ kind: "sep", text: " " }); continue; }
      if (char === ";") { this.index += 1; parts.push({ kind: "sep", text: ";" }); continue; }
      if (this.source.startsWith("+/-", this.index)) { this.index += 3; parts.push({ kind: "rel", text: "±" }); continue; }
      if (char === "_" || char === "^") {
        this.index += 1;
        const script = this.script(char === "^");
        if (script.length === 1 && script[0].kind === "word" && script[0].text === "hat") {
          const previous = parts.pop();
          parts.push(previous && "text" in previous ? { ...previous, text: `${previous.text}̂` } : { kind: "word", text: "hat" });
        } else {
          parts.push({ kind: char === "_" ? "sub" : "sup", parts: script });
        }
        continue;
      }
      if (/[A-Za-z]/.test(char)) { parts.push(...this.word(false)); continue; }
      if (/[0-9.]/.test(char)) { parts.push({ kind: "num", text: this.take(/[0-9.]/) }); continue; }
      this.index += 1;
      const relation = relations.get(char);
      if (relation) parts.push({ kind: "rel", text: relation });
      else parts.push({ kind: "op", text: operators.get(char) ?? char });
    }
    return parts;
  }

  /** A script is a parenthesized group, a signed fraction such as -1/2, or one alphanumeric run. */
  private script(superscript: boolean): EquationPart[] {
    const char = this.source[this.index];
    if (char === "(") {
      this.index += 1;
      const parts = this.sequence(true);
      if (this.source[this.index] === ")") this.index += 1;
      return parts;
    }
    if (superscript && char === "-") {
      this.index += 1;
      return [{ kind: "op", text: "−" }, ...this.script(true)];
    }
    if (/[0-9]/.test(char ?? "")) {
      const parts: EquationPart[] = [{ kind: "num", text: this.take(/[0-9.]/) }];
      if (superscript && this.source[this.index] === "/" && /[0-9]/.test(this.source[this.index + 1] ?? "")) {
        this.index += 1;
        parts.push({ kind: "op", text: "/" }, { kind: "num", text: this.take(/[0-9.]/) });
      }
      return parts;
    }
    if (/[A-Za-z]/.test(char ?? "")) return this.word(true);
    return [];
  }

  private word(inScript: boolean): EquationPart[] {
    const letters = this.take(/[A-Za-z]/);
    const digits = inScript ? this.take(/[0-9]/) : "";
    const trailing = inScript ? [] : this.digitsAsSubscript();
    return [...classify(letters, inScript), ...(digits ? [{ kind: "num", text: digits } as const] : []), ...trailing];
  }

  /** "f0" and "log2" carry their index as a subscript. */
  private digitsAsSubscript(): EquationPart[] {
    const digits = this.take(/[0-9]/);
    return digits ? [{ kind: "sub", parts: [{ kind: "num", text: digits }] }] : [];
  }

  private take(pattern: RegExp): string {
    const start = this.index;
    while (this.index < this.source.length && pattern.test(this.source[this.index])) this.index += 1;
    return this.source.slice(start, this.index);
  }
}

function classify(letters: string, inScript: boolean): EquationPart[] {
  const letter = greek.get(letters);
  if (letter) return [{ kind: uprightGreek.has(letters) ? "word" : "var", text: letter }];
  if (letters.startsWith("d") && greek.has(letters.slice(1))) return [{ kind: "word", text: "d" }, ...classify(letters.slice(1), inScript)];
  if (letters === "sum") return [{ kind: "op", text: "∑" }];
  if (letters === "sqrt") return [{ kind: "op", text: "√" }];
  if (letters === "fs") return [{ kind: "var", text: "f" }, { kind: "sub", parts: [{ kind: "var", text: "s" }] }];
  const relation = relations.get(letters);
  if (relation) return [{ kind: "rel", text: relation }];
  const split = splitWords.get(letters);
  if (split) return split.map((text) => ({ kind: text === "d" ? "word" : "var", text }));
  if (letters.length === 1) return [{ kind: "var", text: letters }];
  // Index pairs such as P_ij stay italic; named quantities stay roman.
  if (inScript && letters.length === 2 && letters === letters.toLowerCase()) return [...letters].map((text) => ({ kind: "var", text }));
  return [{ kind: "word", text: letters }];
}

/** Relations carry their own spacing; plain spaces become thin spaces between symbols. A √ claims the group after it. */
function tidy(parts: readonly EquationPart[]): EquationPart[] {
  const result: EquationPart[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if ("parts" in part) { result.push({ ...part, parts: tidy(part.parts) }); continue; }
    if (part.kind === "op" && part.text === "√" && isOpen(parts[index + 1])) {
      const end = closingIndex(parts, index + 1);
      if (end > index + 1) {
        result.push({ kind: "sqrt", parts: tidy(parts.slice(index + 2, end)) });
        index = end;
        continue;
      }
    }
    if (part.kind === "op" && (part.text === "+" || part.text === "−") && isOperand(result.at(-1))) {
      result.push({ kind: "bin", text: part.text });
      continue;
    }
    if (part.kind === "sep" && part.text === " ") {
      const previous = result.at(-1);
      const next = parts[index + 1];
      if (!previous || !next || isSpaced(previous) || isSpaced(next) || (previous.kind === "sep")) continue;
    }
    result.push(part);
  }
  return result;
}

function isSpaced(part: EquationPart): boolean {
  return part.kind === "rel" || part.kind === "bin" || (part.kind === "sep" && part.text === ";")
    || (part.kind === "op" && (part.text === "+" || part.text === "−"));
}

/** A sign after an operand is a binary operator; after a relation or an opening bracket it is a unary sign. */
function isOperand(part: EquationPart | undefined): boolean {
  if (!part) return false;
  if (!("text" in part)) return true;
  if (part.kind === "sep") return part.text === " ";
  if (part.kind === "op") return part.text === ")" || part.text === "]" || part.text === "|";
  return part.kind !== "rel" && part.kind !== "bin";
}

function isOpen(part: EquationPart | undefined): boolean {
  return part !== undefined && part.kind === "op" && "text" in part && part.text === "(";
}

function closingIndex(parts: readonly EquationPart[], open: number): number {
  let depth = 0;
  for (let index = open; index < parts.length; index += 1) {
    const part = parts[index];
    if (part.kind !== "op" || !("text" in part)) continue;
    if (part.text === "(") depth += 1;
    if (part.text === ")") depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}
