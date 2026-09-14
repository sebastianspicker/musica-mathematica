import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

// Use the real Pages build in a fresh context, with synthetic lesson data only.
const url = process.argv[2] ?? "http://127.0.0.1:4175/musica-mathematica/";
const output = fileURLToPath(new URL("../docs/assets/screenshots/", import.meta.url));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    locale: "en-GB",
    timezoneId: "UTC",
    colorScheme: "light",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  await mkdir(output, { recursive: true });
  await page.goto(url);
  await expect(page).toHaveTitle("Musica Mathematica");
  await expect(page.getByRole("heading", { name: "Controlled comparison", exact: true })).toBeVisible();
  await expect(page.locator(".mm-notebook-footer").getByText("Demo data · separate portfolio", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  async function capture(name) {
    await page.evaluate(() => scrollTo(0, 0));
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${output}${name}.png`, animations: "disabled", fullPage: name !== "curriculum" });
  }

  await capture("controlled-comparison");
  await page.getByRole("button", { name: "Lessons", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Choose your inquiry" })).toBeVisible();
  await expect(page.locator(".mm-curriculum-rail__lesson")).toHaveCount(24);
  await capture("curriculum");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Lessons", exact: true })).toBeFocused();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restart lesson", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start with a prediction" })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss message" }).click();
  await capture("workbench-overview");
  await page.getByRole("button", { name: "Start with a prediction" }).click();
  await page.locator('[name="prediction"]').fill("At 120 BPM, each beat will last 0.500 seconds instead of 0.667 seconds. Beats per bar will stay at four.");
  await page.getByRole("button", { name: "Commit prediction & begin" }).click();
  await page.getByRole("button", { name: "Record Run A", exact: true }).click();
  await page.getByLabel("Tempo", { exact: true }).fill("120");
  await expect(page.locator(".mm-notebook-run--preview")).toContainText("0.500 s");
  await capture("experiment");
  await page.getByRole("button", { name: "Record Run B", exact: true }).click();
  await page.getByRole("button", { name: "Compare the latest two runs" }).click();
  await expect(page.getByRole("heading", { name: "Controlled comparison", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  console.log(`Captured four screenshots from ${page.url()} in ${output}`);
} finally {
  await browser.close();
}
