import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const linter = new ESLint();
const portable = ["shared", "curriculum", "learning", "domains/ensemble-dynamics", "audio/analysis", "audio/protocol", "ui"];
async function ruleIds(code: string, filePath: string) {
  const [result] = await linter.lintText(code, { filePath });
  return result.messages.map((message) => message.ruleId);
}

// The first lint loads the full flat config and parsers; allow for a cold start under parallel test load.
describe("architecture lint enforcement", { timeout: 30_000 }, () => {
  it.each(portable)("blocks browser globals in %s", async (layer) => {
    for (const access of ["window.localStorage", "document.body", "navigator.mediaDevices", "globalThis.fetch", "self.location", "fetch('/')"]) {
      expect(await ruleIds(`export const value = ${access};`, `src/${layer}/boundaryProbe.ts`)).toContain("no-restricted-globals");
    }
  });
  it.each(portable)("blocks the extended browser-global denylist in %s", async (layer) => {
    for (const access of [
      "addEventListener('x', () => {})", "removeEventListener('x', () => {})", "dispatchEvent(new Event('x'))",
      "performance.now()", "crypto.randomUUID()", "new Blob([])", "URL.createObjectURL(x)", "scrollTo(0, 0)",
      "queueMicrotask(() => {})", "postMessage(1)", "new ResizeObserver(() => {})", "new IntersectionObserver(() => {})",
      "new MutationObserver(() => {})", "requestIdleCallback(() => {})", "alert('x')", "confirm('x')", "prompt('x')",
    ]) {
      expect(await ruleIds(`export const value = ${access};`, `src/${layer}/boundaryProbe.ts`), access).toContain("no-restricted-globals");
    }
  });
  it("allows timing only in the analysis benchmark and type-only URL references", async () => {
    expect(await ruleIds("export const value = performance.now();", "src/audio/analysis/probe.performance.bench.ts")).toEqual([]);
    expect(await ruleIds("export const value = performance.now();", "src/audio/analysis/boundaryProbe.ts")).toContain("no-restricted-globals");
    expect(await ruleIds("export type Link = URL;", "src/ui/boundaryProbe.ts")).toEqual([]);
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
    expect(await ruleIds('import { simulateEnsemble } from "../../domains/ensemble-dynamics/model"; export { simulateEnsemble };', "src/ui/workbench/boundaryProbe.ts")).toContain("no-restricted-imports");
  });
  it("keeps app modules off domains and shared utilities off curriculum", async () => {
    expect(await ruleIds('import { value } from "../domains/pitch-tuning/lessons"; export { value };', "src/app/boundaryProbe.ts")).toContain("no-restricted-imports");
    expect(await ruleIds('import { value } from "../curriculum/registry"; export { value };', "src/app/boundaryProbe.ts")).toEqual([]);
    expect(await ruleIds('import type { FactorValue } from "../../curriculum/contracts"; export type Value = FactorValue;', "src/shared/numeric/boundaryProbe.ts")).toContain("no-restricted-imports");
  });
  it("keeps domains and domain support off the curriculum catalog composition root", async () => {
    const catalogImport = 'import { curriculumRegistry } from "../../curriculum/catalog"; export { curriculumRegistry };';
    expect(await ruleIds(catalogImport, "src/domains/pitch-tuning/boundaryProbe.ts")).toContain("no-restricted-imports");
    expect(await ruleIds(catalogImport, "src/domains/support/boundaryProbe.ts")).toContain("no-restricted-imports");
    expect(await ruleIds('import { createCurriculumRegistry } from "../../curriculum/registry"; export { createCurriculumRegistry };', "src/domains/pitch-tuning/boundaryProbe.ts")).toEqual([]);
  });
  it("blocks a domain importing another domain", async () => {
    expect(await ruleIds('import { value } from "../rhythm-meter/lessons"; export { value };', "src/domains/pitch-tuning/boundaryProbe.ts")).toContain("no-restricted-imports");
  });
  it("blocks learning modules importing domains and the curriculum catalog", async () => {
    expect(await ruleIds('import { value } from "../domains/pitch-tuning/lessons"; export { value };', "src/learning/boundaryProbe.ts")).toContain("no-restricted-imports");
    expect(await ruleIds('import { value } from "../curriculum/catalog"; export { value };', "src/learning/boundaryProbe.ts")).toContain("no-restricted-imports");
  });
  it("blocks browser audio adapters importing the app layer", async () => {
    expect(await ruleIds('import { value } from "../../app/portfolio/browserStorage"; export { value };', "src/audio/browser/boundaryProbe.ts")).toContain("no-restricted-imports");
  });
  it.each(["audio/analysis", "audio/protocol"])("blocks sibling-relative browser adapter imports in %s", async (layer) => {
    expect(await ruleIds('import { value } from "../browser/capture"; export { value };', `src/${layer}/boundaryProbe.ts`)).toContain("no-restricted-imports");
    expect(await ruleIds('import { value } from "../browser"; export { value };', `src/${layer}/boundaryProbe.ts`)).toContain("no-restricted-imports");
  });
  it("allows the curriculum catalog to compose domains", async () => {
    expect(await ruleIds('import { value } from "../domains/pitch-tuning/lessons"; export { value };', "src/curriculum/catalog.ts")).toEqual([]);
  });
  it("keeps test helpers out of production code but allows them in tests", async () => {
    const helperImport = 'import { testCurriculum } from "./curriculumFixture.test-helper"; export { testCurriculum };';
    expect(await ruleIds(helperImport, "src/learning/portfolio/boundaryProbe.ts")).toContain("no-restricted-imports");
    expect(await ruleIds(helperImport, "src/app/boundaryProbe.ts")).toContain("no-restricted-imports");
    expect(await ruleIds(helperImport, "src/learning/portfolio/boundaryProbe.test.ts")).toEqual([]);
    expect(await ruleIds(helperImport, "src/learning/portfolio/other.test-helper.ts")).toEqual([]);
  });
  it("keeps legacy migration independent of inquiry and curriculum evidence", async () => {
    expect(await ruleIds('import { value } from "../../inquiry/comparison"; export { value };', "src/learning/portfolio/legacy/boundaryProbe.ts")).toContain("no-restricted-imports");
    expect(await ruleIds('import { value } from "../../../curriculum/evidence"; export { value };', "src/learning/portfolio/legacy/boundaryProbe.ts")).toContain("no-restricted-imports");
  });
  it("enforces hooks order and dependencies", async () => {
    expect(await ruleIds('import { useState } from "react"; export function View({ enabled }: { enabled: boolean }) { if (enabled) useState(0); return null; }', "src/app/boundaryProbe.tsx")).toContain("react-hooks/rules-of-hooks");
    expect(await ruleIds('import { useEffect } from "react"; export function View({ value }: { value: string }) { useEffect(() => { document.title = value; }, []); return null; }', "src/app/boundaryProbe.tsx")).toContain("react-hooks/exhaustive-deps");
  });
});
