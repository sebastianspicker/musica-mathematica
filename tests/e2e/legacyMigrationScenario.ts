import { expect, type Page } from "@playwright/test";
import { simulateEnsemble } from "../../src/simulation/ensemble";
import { defaultConfig } from "../../src/simulation/presets";

const portfolioKey = "musicaMathematica.learning.v2";
const legacyKey = "ensembleCouplingLab.learning.v1";

async function seedLegacyStorage(page: Page): Promise<void> {
  const config = {
    ...defaultConfig,
    tempoBpm: 132,
    tempoSpreadBpm: 5,
    couplingStrength: 1.6,
    latencySeconds: 0.075,
    jitterSeconds: 0.012,
    topology: "sections" as const,
    repertoireTexture: "dense-rhythm" as const,
  };
  const metrics = simulateEnsemble(config, 1).finalMetrics;
  await page.addInitScript((payload) => {
    window.localStorage.setItem(payload.key, JSON.stringify(payload.value));
  }, {
    key: legacyKey,
    value: {
      version: 1,
      lessonId: "latency",
      stage: "experiment",
      prediction: "Lower tempo will change the model budget.",
      runs: [{
        id: "Legacy latency run",
        durationSeconds: 1,
        config,
        metrics,
        note: "Legacy latency fixture",
      }],
    },
  });
}

async function legacyStoragePresence(page: Page): Promise<{ v2: boolean; v1: boolean }> {
  return page.evaluate((keys) => ({
    v2: window.localStorage.getItem(keys[0]) !== null,
    v1: window.localStorage.getItem(keys[1]) !== null,
  }), [portfolioKey, legacyKey]);
}

export async function verifyLegacyMigration(page: Page): Promise<void> {
  await seedLegacyStorage(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Delay, Jitter, and Topology" })).toBeVisible();
  await expect(page).toHaveURL(/#\/labs\/ensemble-dynamics\/lessons\/delay-jitter-topology$/);
  await expect(page.getByLabel("One-way delay")).toHaveValue("75");
  await expect(page.getByLabel("Delay variation")).toHaveValue("12");
  await expect(page.getByLabel("Peer coupling")).toHaveValue("1.6");
  await expect(page.getByLabel("Listening topology")).toHaveValue("sections");
  await expect.poll(() => legacyStoragePresence(page)).toEqual({ v2: true, v1: true });
}
