import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";

const outputDirectory = await mkdtemp(join(tmpdir(), "musica-mathematica-worklet-"));

afterAll(async () => {
  await rm(outputDirectory, { force: true, recursive: true });
});

describe("AudioWorklet production bundle", () => {
  it("emits the capture processor as a same-origin JavaScript asset", async () => {
    await build({
      configFile: resolve(dirname(fileURLToPath(import.meta.url)), "../../../vite.config.ts"),
      logLevel: "silent",
      build: {
        emptyOutDir: true,
        outDir: outputDirectory,
      },
    });

    const assetsDirectory = join(outputDirectory, "assets");
    const assetNames = await readdir(assetsDirectory);
    const workletAssetName = assetNames.find((name) => /^captureProcessor-.+\.js$/.test(name));

    expect(workletAssetName).toBeDefined();

    const workletSource = await readFile(join(assetsDirectory, workletAssetName), "utf8");
    expect(workletSource).toContain("registerProcessor");
    expect(workletSource).toContain("musica-mathematica-capture");
    expect(workletSource).not.toContain("data:video/mp2t");
    expect(workletSource).not.toContain("captureProcessor.ts");

    const applicationAssetNames = assetNames.filter((name) => /^index-.+\.js$/.test(name));
    const applicationSources = await Promise.all(
      applicationAssetNames.map((name) => readFile(join(assetsDirectory, name), "utf8")),
    );
    expect(applicationSources.join("\n")).toContain(workletAssetName);
  }, 30_000);
});
