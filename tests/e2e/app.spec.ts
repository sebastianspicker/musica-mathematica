import { expect, test, type Page } from "@playwright/test";
import { verifyLegacyMigration } from "./legacyMigrationScenario";

const portfolioKey = "musicaMathematica.learning.v2";
type PageFixture = Readonly<{ page: Page }>;

test("mounts the eight-domain workbench with honest result provenance", async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto("/");

  await expect(page).toHaveTitle("Musica Mathematica");
  await expect(page.getByText("Musica Mathematica", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Mathematical music curriculum" })).toBeVisible();
  await expect(page.locator(".mm-curriculum-rail__domain")).toHaveCount(8);
  await expect(page.locator(".mm-curriculum-rail__lesson")).toHaveCount(24);
  await expect(page.getByRole("heading", { name: "From BPM to Period" })).toBeVisible();
  await expect(page.getByRole("figure").getByText("Mathematical result")).toBeVisible();
  await expect(page.getByText("uncalibrated", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeDisabled();
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), portfolioKey)).not.toBeNull();
  expect(errors).toEqual([]);
});

test("hash routes connect all domains while factors stay gated until prediction", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: /Ensemble Dynamics/ }).click();
  await page.locator('a[href="#/labs/ensemble-dynamics/lessons/delay-jitter-topology"]').click();
  await expect(page).toHaveURL(/#\/labs\/ensemble-dynamics\/lessons\/delay-jitter-topology$/);
  await expect(page.getByRole("heading", { name: "Delay, Jitter, and Topology" })).toBeVisible();
  await expect(page.getByLabel("One-way delay")).toBeDisabled();

  await page.getByRole("button", { name: "Start with a prediction" }).click();
  await page.getByRole("textbox", { name: /Predict which selected factor/ }).fill(
    "More configured delay should increase phase spread in this model.",
  );
  await page.getByRole("button", { name: "Save prediction and begin experiment" }).click();
  await expect(page.getByLabel("One-way delay")).toBeEnabled();
  await page.getByLabel("One-way delay").fill("80");
  await expect(page.getByRole("figure").getByText(/r = /)).toBeVisible();

  await page.getByRole("link", { name: /Rhythm & Meter/ }).click();
  await page.locator('a[href="#/labs/rhythm-meter/lessons/autocorrelation-spectrum-meter"]').click();
  await expect(page.getByRole("heading", { name: "Autocorrelation, Spectrum, and Meter" })).toBeVisible();
  await expect(page.getByText("Ranked periodicity")).toBeVisible();
});

test("a learner can complete, resume, export, and clear a v2 inquiry", async ({ page }) => {
  await page.goto("/");
  await beginDefaultExperiment(page);

  const stage = page.locator(".mm-stage-card");
  await stage.getByLabel("Optional observation note").fill("Baseline at 90 BPM");
  await page.getByRole("button", { name: "Record Run A" }).click();
  await expect(page.getByText("Run A recorded locally.")).toBeVisible();
  await page.getByRole("spinbutton", { name: "Tempo", exact: true }).fill("120");
  await page.getByRole("button", { name: "Record Run B" }).click();
  await expect(page.locator(".mm-comparison-readiness")).toHaveText("Controlled comparison ready: only Tempo changed.");
  await stage.getByRole("button", { name: "Compare the latest two runs" }).click();
  await page.getByText("View detailed factor and observable tables").click();
  await expect(page.getByRole("table", { name: "Factors in the two latest runs" })).toBeVisible();
  await page.getByRole("button", { name: "Interpret the evidence" }).click();
  await page.locator('textarea[name="explanation"]').fill(
    "Tempo changed the exact inverse period while performance variability remained outside the calculation.",
  );
  await page.getByRole("button", { name: "Save interpretation and try the musical task" }).click();
  await page.locator('textarea[name="performanceReflection"]').fill(
    "Performing exposed phrasing and attack variation that the BPM conversion does not represent.",
  );
  await page.getByRole("button", { name: "Save reflection and transfer" }).click();
  await page.locator('textarea[name="transferResponse"]').fill(
    "I calculated a four-beat bar and then compared it with the duration of a recorded phrase.",
  );
  await page.getByRole("button", { name: "Save transfer and open debrief" }).click();
  await expect(page.getByRole("heading", { name: "Debrief complete" })).toBeVisible();

  await expect.poll(() => page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const portfolio = JSON.parse(raw);
    const attempt = portfolio.attempts["phase-proportion:from-bpm-to-period"];
    return {
      version: portfolio.version,
      stage: attempt.stage,
      trials: attempt.trials.length,
      note: attempt.trials[0].note,
      hasRawAudio: JSON.stringify(portfolio).includes("rawPcm"),
    };
  }, portfolioKey)).toEqual({ version: 2, stage: "debrief", trials: 2, note: "Baseline at 90 BPM", hasRawAudio: false });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Debrief complete" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export portfolio" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("musica-mathematica-portfolio.json");

  await page.getByRole("button", { name: "Clear local work" }).click();
  const clearDialog = page.getByRole("dialog", { name: "Clear all local work?" });
  await expect(clearDialog).toBeVisible();
  await clearDialog.getByRole("button", { name: "Clear all local work" }).click();
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), portfolioKey)).toBeNull();
});

test("valid legacy ensemble work migrates without deleting the v1 key", ({ page }) => verifyLegacyMigration(page));

test("storage failure stays honest and export remains available", verifyStorageFailure);

test("reduced motion preserves manual stepping and audio failure is reported", verifyReducedMotion);

test("small viewports retain the task and expose presentation mode", verifySmallViewport);

async function verifyStorageFailure({ page }: PageFixture): Promise<void> {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string): void {
      if (this === window.localStorage) throw new DOMException("blocked", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Browser storage is unavailable");
  await expect(page.getByRole("button", { name: "Export portfolio" })).toBeEnabled();
}

async function verifyReducedMotion({ page }: PageFixture): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => Object.defineProperty(window, "AudioContext", { configurable: true, value: undefined }));
  await page.goto("/");

  await expect(page.getByLabel("Motion")).not.toBeChecked();
  await beginDefaultExperiment(page);
  await expect(page.getByRole("button", { name: "Play" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Step 0.5 s" })).toBeEnabled();
  await page.getByRole("button", { name: "Step 0.5 s" }).click();
  await expect(page.getByText("0.5 / 8.0 s")).toBeVisible();

  await page.getByLabel("Audio").click();
  await expect(page.getByLabel("Audio")).not.toBeChecked();
  await expect(page.locator(".mm-audio-message")).toHaveText("Audio unavailable in this browser.");
}

async function verifySmallViewport({ page }: PageFixture): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "From BPM to Period" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Mathematical music curriculum" })).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);

  await page.getByRole("button", { name: "Presentation mode" }).click();
  await expect(page.getByRole("navigation", { name: "Mathematical music curriculum" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Exit presentation" })).toBeVisible();
}

async function beginDefaultExperiment(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Start with a prediction" }).click();
  await page.getByRole("textbox", { name: /Before changing tempo/ }).fill(
    "Doubling BPM should halve the exact beat period.",
  );
  await page.getByRole("button", { name: "Save prediction and begin experiment" }).click();
}

function captureRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
