import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";

const outputDirectory = await mkdtemp(join(tmpdir(), "musica-mathematica-worklet-"));
const pagesBase = "/musica-mathematica/";

afterAll(async () => {
  await rm(outputDirectory, { force: true, recursive: true });
});

describe("GitHub Pages audio production bundle", () => {
  it("emits base-aware application, worker, worklet, and font assets", async () => {
    await build({
      configFile: resolve(dirname(fileURLToPath(import.meta.url)), "../vite.config.ts"),
      logLevel: "silent",
      mode: "pages",
      build: {
        emptyOutDir: true,
        outDir: outputDirectory,
      },
    });

    const assetsDirectory = join(outputDirectory, "assets");
    const assetNames = await readdir(assetsDirectory);
    const workletAssetName = assetNames.find((name) => /^captureProcessor-.+\.js$/.test(name));

    if (!workletAssetName) throw new Error("The build emitted no captureProcessor asset.");

    const workletSource = await readFile(join(assetsDirectory, workletAssetName), "utf8");
    expect(workletSource).toContain("registerProcessor");
    expect(workletSource).toContain("musica-mathematica-capture");
    expect(workletSource).not.toContain("data:video/mp2t");
    expect(workletSource).not.toContain("captureProcessor.ts");

    const analysisWorkerAssetName = assetNames.find((name) => /^analysisWorker-.+\.js$/.test(name));
    if (!analysisWorkerAssetName) throw new Error("The build emitted no analysisWorker asset.");

    const applicationAssetNames = assetNames.filter((name) => /^index-.+\.js$/.test(name));
    const applicationSources = await Promise.all(
      applicationAssetNames.map((name) => readFile(join(assetsDirectory, name), "utf8")),
    );
    const applicationSource = applicationSources.join("\n");
    expect(applicationSource).toContain(`${pagesBase}assets/${workletAssetName}`);
    expect(applicationSource).toContain(`${pagesBase}assets/${analysisWorkerAssetName}`);
    expect(applicationSource).toContain("musicaMathematica.demo.learning.v2");

    const indexHtml = await readFile(join(outputDirectory, "index.html"), "utf8");
    expect(indexHtml).toContain(`${pagesBase}assets/`);
    expect(indexHtml).toContain(`href="${pagesBase}favicon.svg"`);

    const stylesheetAssetName = assetNames.find((name) => /^index-.+\.css$/.test(name));
    if (!stylesheetAssetName) throw new Error("The build emitted no index stylesheet.");
    const stylesheet = await readFile(join(assetsDirectory, stylesheetAssetName), "utf8");
    expect(stylesheet).toContain(`${pagesBase}fonts/`);
  }, 30_000);
});
