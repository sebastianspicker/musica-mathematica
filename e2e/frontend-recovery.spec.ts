import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import { curriculumRegistry } from "../src/curriculum/catalog";
import { createDemoPortfolio } from "../src/app/demo/demoPortfolio";
import { portfolioStorageKey } from "../src/learning/portfolio/schema";

const storageKey = portfolioStorageKey;
const resultVisualInstanceId = "const instanceId = useId();";

let server: ViteDevServer;
let fixtureUrl: string;

test.beforeAll(async () => {
  // The failure exists only in this development fixture, never in product code.
  server = await createServer({
    root: process.cwd(),
    mode: "development",
    base: "/",
    server: { host: "127.0.0.1", port: 0, watch: null },
    plugins: [{
      name: "lesson-recovery-test-fixture",
      enforce: "pre",
      transform: (code, id) => {
        if (id.endsWith("/src/main.tsx")) return 'import "/e2e/fixtures/lessonRecoveryMain.tsx";';
        if (id.endsWith("/src/ui/workbench/ResultVisual.tsx")) {
          if (!code.includes(resultVisualInstanceId)) throw new Error(`ResultVisual.tsx no longer contains "${resultVisualInstanceId}"; update the chart render counter.`);
          return code.replace(resultVisualInstanceId, `globalThis.__chartRenderCount = (globalThis.__chartRenderCount ?? 0) + 1; ${resultVisualInstanceId}`);
        }
        return code;
      },
    }],
  });
  await server.listen();
  fixtureUrl = server.resolvedUrls!.local[0]!;
});

test.afterAll(async () => { await server?.close(); });

test("lesson render recovery uses defaults and preserves the saved portfolio", async ({ page }, testInfo) => {
  const portfolio = createDemoPortfolio(curriculumRegistry);
  const serialized = JSON.stringify(portfolio);
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: storageKey, value: serialized });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(fixtureUrl);
  await expect(page).toHaveTitle(/Musica Mathematica/);
  await expect(page.getByRole("alert")).toContainText("Your saved attempts and recorded runs have been preserved");
  if (testInfo.project.name === "root-chromium") await page.screenshot({ path: "/tmp/mm-lesson-recovery-error.png" });
  const retry = page.getByRole("button", { name: "Retry with default factors" });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "From BPM to Period", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Controlled comparison" })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(serialized);
  const chartRenders = await page.evaluate(() => Reflect.get(globalThis, "__chartRenderCount"));
  expect(chartRenders).toBeGreaterThan(0);
  const modelDetails = page.locator("details").filter({ has: page.getByText("Explore the model, charts and playback", { exact: true }) });
  await modelDetails.getByText("Explore the model, charts and playback", { exact: true }).click();
  await expect(modelDetails.getByLabel("Tempo", { exact: true })).toHaveValue("90");
  await expect(modelDetails.locator(".mm-result-visual__svg")).toBeVisible();
  await page.getByLabel("Motion", { exact: true }).check();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(page.locator(".mm-transport-time")).not.toContainText("0.0 /");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect(await page.evaluate(() => Reflect.get(globalThis, "__chartRenderCount"))).toBe(chartRenders);
  expect(pageErrors).toEqual([]);
  // React reports the intentionally caught exception in development.
  expect(consoleErrors.length).toBeGreaterThan(0);
  expect(consoleErrors.every((message) => message.includes("Injected lesson render failure") || (message.includes("The above error occurred in the <LessonSession> component") && message.includes("LessonErrorBoundary")))).toBe(true);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  if (testInfo.project.name === "root-chromium") {
    await page.screenshot({ path: "/tmp/mm-lesson-recovery-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "From BPM to Period", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "/tmp/mm-lesson-recovery-mobile.png" });
  }
});
