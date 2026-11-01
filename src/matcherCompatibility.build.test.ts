import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Resolve each actual consumer edge; a root-only matcher would miss pnpm's isolated graph.
const projectRequire = createRequire(import.meta.url);
const eslintRequire = createRequire(projectRequire.resolve("eslint"));
const parserRequire = createRequire(projectRequire.resolve("@typescript-eslint/parser"));
const consumers = [
  ["ESLint", eslintRequire],
  ["flat config", createRequire(eslintRequire.resolve("@eslint/config-array"))],
  ["TypeScript project service", createRequire(parserRequire.resolve("@typescript-eslint/typescript-estree"))],
] as const;

type Matcher = {
  Minimatch: new (
    pattern: string,
    options: { dot?: boolean; optimizationLevel?: number; braceExpandMax?: number },
  ) => { set: unknown[]; match: (path: string, partial?: boolean) => boolean };
  minimatch: (path: string, pattern: string, options?: { dot?: boolean }) => boolean;
};

describe("toolchain matcher compatibility", () => {
  it.each(consumers)("%s bounds expansions and retains file-selection behavior", (_name, consumerRequire) => {
    const { Minimatch, minimatch } = consumerRequire("minimatch") as Matcher;
    for (const pattern of [
      `${Array(8).fill("**/../x").join("/")}/file.ts`,
      "{a,b,c,d,e,f,g,h,i}/file.ts",
      "**/../{a,b}/**/../x/file.ts",
    ]) {
      const matcher = new Minimatch(pattern, { dot: true, optimizationLevel: 2, braceExpandMax: 8 });
      expect(matcher.set.length).toBeLessThanOrEqual(8);
    }
    expect(minimatch("src/shared/numeric/validation.ts", "src/{shared,curriculum}/**/*.ts", { dot: true })).toBe(true);
    expect(minimatch("src/app/index.ts", "src/{shared,curriculum}/**/*.ts", { dot: true })).toBe(false);
    expect(minimatch(".hidden.ts", "*.ts", { dot: true })).toBe(true);
    expect(minimatch("file.ts", "!**/*.tmp", { dot: true })).toBe(true);
    expect(new Minimatch("**/*.ts", { dot: true }).match("src/", true)).toBe(true);
  });
});
