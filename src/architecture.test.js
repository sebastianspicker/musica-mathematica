import { describe, expect, it } from "vitest";
import { FlatESLint } from "eslint/use-at-your-own-risk";

const linter = new FlatESLint();
const portable = ["shared", "curriculum", "learning", "domains/ensemble-dynamics", "audio/analysis", "audio/protocol", "ui"];
async function ruleIds(code, filePath) {
  const [result] = await linter.lintText(code, { filePath });
  return result.messages.map((message) => message.ruleId);
}

describe("architecture lint enforcement", () => {
  it.each(portable)("blocks browser globals in %s", async (layer) => {
    for (const access of ["window.localStorage", "document.body", "navigator.mediaDevices", "globalThis.fetch", "self.location", "fetch('/')"]) {
      expect(await ruleIds(`export const value = ${access};`, `src/${layer}/boundaryProbe.ts`)).toContain("no-restricted-globals");
    }
  });
  it.each(portable)("blocks browser adapter imports in %s", async (layer) => {
    expect(await ruleIds('import { value } from "../../audio/browser/nested/adapter"; export { value };', `src/${layer}/boundaryProbe.ts`)).toContain("no-restricted-imports");
  });
  it.each(["app", "audio/browser"])("allows browser adapters in %s", async (layer) => {
    expect(await ruleIds("export const value = window.localStorage;", `src/${layer}/boundaryProbe.ts`)).toEqual([]);
  });
  it("allows shadowed window data and portable numeric utilities", async () => {
    expect(await ruleIds("export function sum(window: number[]) { return window.reduce((a, b) => a + b, 0); }", "src/audio/analysis/boundaryProbe.ts")).toEqual([]);
  });
  it("allows type-only curriculum contracts in UI", async () => {
    expect(await ruleIds('import type { FactorValue } from "../../curriculum/contracts"; export type Value = FactorValue;', "src/ui/workbench/boundaryProbe.ts")).toEqual([]);
  });
  it("blocks React in portable models and domain calculations in UI", async () => {
    expect(await ruleIds('import { useState } from "react"; export { useState };', "src/domains/ensemble-dynamics/boundaryProbe.ts")).toContain("no-restricted-imports");
    expect(await ruleIds('import { simulateEnsemble } from "../../domains/ensemble-dynamics/ensemble"; export { simulateEnsemble };', "src/ui/workbench/boundaryProbe.ts")).toContain("no-restricted-imports");
  });
  it("enforces hooks order and dependencies", async () => {
    expect(await ruleIds('import { useState } from "react"; export function View({ enabled }: { enabled: boolean }) { if (enabled) useState(0); return null; }', "src/app/boundaryProbe.tsx")).toContain("react-hooks/rules-of-hooks");
    expect(await ruleIds('import { useEffect } from "react"; export function View({ value }: { value: string }) { useEffect(() => { document.title = value; }, []); return null; }', "src/app/boundaryProbe.tsx")).toContain("react-hooks/exhaustive-deps");
  });
});
