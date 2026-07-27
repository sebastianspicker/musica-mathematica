/**
 * Capture README interface previews at 1440×1000 against a local Vite server.
 * Usage: node scripts/capture-readme-screenshots.mjs
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/assets/screenshots");
const port = 4175;
const baseURL = `http://127.0.0.1:${port}`;

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become ready at ${url}`);
}

async function beginDefaultExperiment(page) {
  await page.getByRole("button", { name: "Start with a prediction" }).click();
  await page.getByRole("textbox", { name: /Before changing tempo/ }).fill(
    "Doubling BPM should halve the exact beat period.",
  );
  await page.getByRole("button", { name: "Save prediction and begin experiment" }).click();
}

const vite = spawn(
  process.execPath,
  [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
);

try {
  await waitForServer(baseURL);
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });

  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "From BPM to Period" }).waitFor();
  // Allow self-hosted faces to settle before capture.
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, "workbench-overview.png"),
    type: "png",
  });

  await beginDefaultExperiment(page);
  const stage = page.locator(".mm-stage-card");
  await stage.getByLabel("Optional observation note").fill("Baseline at 90 BPM");
  await page.getByRole("button", { name: "Record Run A" }).click();
  await page.getByRole("spinbutton", { name: "Tempo", exact: true }).fill("120");
  await page.getByRole("button", { name: "Record Run B" }).click();
  await page.locator(".mm-comparison-readiness").waitFor();
  await stage.getByRole("button", { name: "Compare the latest two runs" }).click();
  await page.getByText("View detailed factor and observable tables").click();
  const comparison = page.locator(".mm-comparison-table, [aria-label='Comparison and interpretation']").first();
  await comparison.waitFor();
  await page.getByRole("table", { name: "Factors in the two latest runs" }).waitFor();
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    document.querySelector(".mm-workbench-band, .mm-comparison-table")
      ?.scrollIntoView({ block: "start", behavior: "instant" });
  });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, "controlled-comparison.png"),
    type: "png",
  });

  await browser.close();
  console.log(`Wrote:\n  ${path.join(outDir, "workbench-overview.png")}\n  ${path.join(outDir, "controlled-comparison.png")}`);
} finally {
  vite.kill("SIGTERM");
}
