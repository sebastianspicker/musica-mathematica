import { expect, test as base, type Page } from "@playwright/test";
import { curriculumRegistry } from "../src/curriculum/catalog";

const test = base.extend<{ browserHealth: void }>({
  browserHealth: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
    });
    await use();
    expect(errors, "browser console and runtime errors").toEqual([]);
  }, { auto: true }],
});

const lessonRoute = "#/labs/phase-proportion/lessons/from-bpm-to-period";
const ordinaryKey = "musicaMathematica.learning.v2";
const demoKey = "musicaMathematica.demo.learning.v2";
const legacyKey = "ensembleCouplingLab.learning.v1";

async function ensureFreshAttempt(page: Page) {
  if (!await page.getByRole("button", { name: "Start with a prediction" }).count()) {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Restart lesson", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Start with a prediction" })).toBeVisible();
}

async function unlock(page: Page) {
  await ensureFreshAttempt(page);
  await page.getByRole("button", { name: "Start with a prediction" }).click();
  await page.locator('[name="prediction"]').fill("Doubling the tempo halves the duration of each beat.");
  await page.getByRole("button", { name: "Commit prediction & begin" }).click();
}

async function openDetails(page: Page, name: string) {
  const details = page.locator("details").filter({ has: page.getByText(name, { exact: true }) });
  if (!await details.getAttribute("open")) await details.getByText(name, { exact: true }).click();
  return details;
}

async function openLearning(page: Page) {
  await page.getByRole("button", { name: "My learning", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "My learning" });
  await expect(dialog).toBeVisible();
  return dialog;
}

function sineWav() {
  const rate = 8000;
  const samples = rate * 2;
  const data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF"); data.writeUInt32LE(data.length - 8, 4); data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write("data", 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(16000 * Math.sin(2 * Math.PI * 440 * i / rate)), 44 + i * 2);
  return data;
}

test.beforeEach(async ({ page }) => {
  await page.goto(`.${lessonRoute}`);
  await expect(page.getByRole("heading", { name: "From BPM to Period", exact: true })).toBeVisible();
});

test("header dialogs expose the complete curriculum and resumable local records", async ({ page }, testInfo) => {
  const key = testInfo.project.name.startsWith("pages") ? demoKey : ordinaryKey;
  await page.evaluate(({ key }) => localStorage.setItem(key, JSON.stringify({
    version: 2,
    active: { labId: "phase-proportion", lessonId: "from-bpm-to-period" },
    attempts: {},
  })), { key });
  await page.reload();
  const lessonsButton = page.getByRole("button", { name: "Lessons", exact: true });
  await lessonsButton.click();
  const lessonsDialog = page.getByRole("dialog", { name: "Choose your inquiry" });
  await expect(lessonsDialog).toBeVisible();
  const titles = curriculumRegistry.catalog.flatMap((domain) => domain.lessons.map((lesson) => lesson.title));
  await expect(lessonsDialog.locator(".mm-curriculum-rail__lesson")).toHaveCount(24);
  for (const title of titles) await expect(lessonsDialog.getByText(title, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(lessonsDialog).not.toBeVisible();
  await expect(lessonsButton).toBeFocused();

  let learningDialog = await openLearning(page);
  await expect(learningDialog.getByText("No inquiries started yet", { exact: false })).toBeVisible();
  await expect(learningDialog.getByRole("button", { name: "Export portfolio", exact: true })).toBeVisible();
  await expect(learningDialog.getByRole("button", { name: "Clear local work", exact: true })).toBeVisible();
  await expect(learningDialog.getByRole("button", { name: "Presentation mode", exact: true })).toBeVisible();
  await learningDialog.getByRole("button", { name: "Close my learning" }).click();

  await page.getByRole("button", { name: "Start with a prediction" }).click();
  learningDialog = await openLearning(page);
  const savedLesson = learningDialog.getByRole("link", { name: /From BPM to Period/ });
  await expect(savedLesson).toContainText("predict · 2 of 8");
  await savedLesson.click();
  await expect(learningDialog).not.toBeVisible();
  await expect(page.locator("#mm-current-task")).toBeFocused();
});

test("the notebook reveals controls and computed graphics only after prediction", async ({ page }) => {
  await ensureFreshAttempt(page);
  await expect(page.locator(".mm-factor-inspector")).toHaveCount(0);
  await expect(page.getByText("Explore the model, charts and playback", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Start with a prediction" }).click();
  await expect(page.locator(".mm-inquiry .mm-stage-card > h2")).toHaveText("Predict");
  await expect(page.locator(".mm-factor-inspector")).toHaveCount(0);
  await expect(page.locator(".mm-notebook-readings")).toContainText("Tempo");
  await expect(page.locator(".mm-notebook-readings")).toContainText("90 BPM");
  await page.locator('[name="prediction"]').fill("A committed directional prediction.");
  await page.getByRole("button", { name: "Commit prediction & begin" }).click();
  await expect(page.locator(".mm-notebook-prediction")).toContainText("A committed directional prediction.");
  await expect(page.locator('[name="prediction"]')).toHaveCount(0);
  await expect(page.locator(".mm-factor-inspector")).toBeVisible();
  const preview = page.locator(".mm-notebook-run--preview");
  await expect(preview).toContainText("Preview · not recorded");
  await expect(preview.locator("svg")).toHaveCount(0);
  await page.getByLabel("Tempo", { exact: true }).fill("30");
  await expect(preview).toContainText("2.000 s");
  const model = await openDetails(page, "Explore the model, charts and playback");
  await expect(model.locator(".mm-result-visual__svg")).toBeVisible();
});

test("inquiry completion, factor bounds, export, restart and clear", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page).toHaveTitle(/Musica Mathematica/);
  await expect(page.getByRole("heading", { name: "From BPM to Period", exact: true })).toBeVisible();
  await unlock(page);
  const committedPrediction = "Doubling the tempo halves the duration of each beat.";
  await expect(page.locator(".mm-notebook-prediction")).toContainText(committedPrediction);
  await expect(page.locator('[name="prediction"]')).toHaveCount(0);
  await page.getByLabel("Tempo", { exact: true }).fill("30");
  await page.getByRole("button", { name: /Record Run A/ }).click();
  await page.getByLabel("Tempo", { exact: true }).fill("240");
  await page.getByRole("button", { name: /Record Run B/ }).click();
  await page.getByRole("button", { name: "Compare the latest two runs" }).click();
  await page.getByRole("button", { name: /Interpret/ }).click();
  for (const [field, button] of [
    ["explanation", "Save explanation & continue"],
    ["performanceReflection", "Save reflection & continue"],
    ["transferResponse", "Save response & finish"],
  ]) {
    await expect(page.locator(`[name="${field}"]`)).toHaveValue("");
    await page.locator(`[name="${field}"]`).fill("The numerical model predicts durations; performance adds evidence about timing.");
    await page.getByRole("button", { name: button }).click();
  }
  await expect(page.getByRole("heading", { name: "Your inquiry is recorded" })).toBeVisible();
  await expect(page.locator(".mm-stage-card--complete").getByText(committedPrediction, { exact: true })).toBeVisible();
  const retainedModel = await openDetails(page, "Explore the model, charts and playback");
  await expect(retainedModel.getByLabel("Tempo", { exact: true })).toBeEnabled();
  await expect(retainedModel.locator(".mm-result-visual__svg")).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export portfolio", exact: true }).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const portfolio = JSON.parse(Buffer.concat(chunks).toString());
  expect(portfolio.version).toBe(2);
  const attempt = portfolio.attempts["phase-proportion:from-bpm-to-period"];
  expect(attempt.stage).toBe("debrief");
  expect(attempt.prediction).toBe(committedPrediction);
  expect(attempt.trials.map((trial: { factors: { bpm: number } }) => trial.factors.bpm)).toEqual([30, 240]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restart lesson", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start with a prediction" })).toBeVisible();
  const inactiveKey = testInfo.project.name.startsWith("pages") ? ordinaryKey : demoKey;
  await page.evaluate(({ inactiveKey }) => localStorage.setItem(inactiveKey, "untouched"), { inactiveKey });
  const learningDialog = await openLearning(page);
  await learningDialog.getByRole("button", { name: "Clear local work", exact: true }).click();
  const clearDialog = page.getByRole("dialog", { name: testInfo.project.name.startsWith("pages") ? "Reset the demo?" : "Clear all local work?" });
  await page.getByRole("button", { name: testInfo.project.name.startsWith("pages") ? "Reset demo data" : "Clear all local work", exact: true }).click();
  await expect(clearDialog).not.toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), inactiveKey)).toBe("untouched");
  expect(errors).toEqual([]);
});

test("playback, reduced motion and navigation focus", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await unlock(page);
  await openDetails(page, "Explore the model, charts and playback");
  await expect(page.getByLabel("Motion", { exact: true })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Step 0.5 s" }).click();
  await expect(page.locator(".mm-transport-time")).toContainText("0.5 /");
  await page.getByLabel("Motion", { exact: true }).check();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(page.locator(".mm-transport-time")).not.toContainText("0.5 /");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(page.locator(".mm-transport-time")).toContainText("0.0 /");
  await page.getByRole("button", { name: "Lessons", exact: true }).click();
  await page.getByRole("dialog", { name: "Choose your inquiry" }).locator('a[href$="/lessons/polyrhythm-return-times"]').click();
  await expect(page).toHaveURL(/polyrhythm-return-times$/);
  await expect(page.locator("#mm-current-task")).toBeFocused();
});

test("deterministic file analysis survives Compare and stays local", async ({ page }) => {
  await page.goto(".#/labs/timbre-acoustics/lessons/time-varying-timbre");
  await expect(page.getByRole("heading", { name: "Time-Varying Timbre", exact: true })).toBeVisible();
  await unlock(page);
  await page.getByRole("button", { name: "Record Run A", exact: true }).click();
  await expect(page.locator(".mm-notebook-run--recorded")).toContainText("Run A");
  await page.getByLabel("Attack", { exact: true }).fill("160");
  await page.getByRole("button", { name: "Record Run B", exact: true }).click();
  await expect(page.getByRole("button", { name: "Compare the latest two runs" })).toBeEnabled();
  await page.getByLabel("Analysis source").selectOption("file");
  const model = page.locator("details").filter({ has: page.getByText("Explore the model, charts and playback", { exact: true }) });
  await expect(model).toHaveAttribute("open", "");
  const fileInput = model.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: "deterministic.wav", mimeType: "audio/wav", buffer: sineWav() });
  // This covers the analysis flow; browser resampling can decode the fixture a frame short of two seconds.
  await model.getByLabel("Duration", { exact: true }).fill("1.5");
  await page.getByRole("button", { name: /Analyze selected/ }).click();
  const analyzed = model.locator(".mm-audio-input__status");
  await expect(analyzed).toContainText("Local analysis complete", { timeout: 20_000 });
  expect(await fileInput.evaluate((input: HTMLInputElement) => input.files?.[0]?.name)).toBe("deterministic.wav");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("deterministic.wav");

  await page.getByRole("button", { name: "Compare the latest two runs" }).click();
  await expect(page.locator(".mm-inquiry .mm-stage-card > h2")).toHaveText("Compare your recorded runs");
  await expect(model).toHaveAttribute("open", "");
  await expect(analyzed).toContainText("Local analysis complete");
  expect(await fileInput.evaluate((input: HTMLInputElement) => input.files?.[0]?.name)).toBe("deterministic.wav");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("deterministic.wav");
});

test("controlled comparison rejects unchanged and multi-factor runs", async ({ page }) => {
  await page.goto(".#/labs/pitch-tuning/lessons/temperaments-and-commas");
  await expect(page.getByRole("heading", { name: "Temperaments and Commas", exact: true })).toBeVisible();
  await unlock(page);
  await openDetails(page, "Adjust other factors");
  await page.getByRole("button", { name: "Record Run A", exact: true }).click();
  await expect(page.getByRole("button", { name: "Compare the latest two runs" })).toBeDisabled();
  await page.getByRole("button", { name: "Record Run B", exact: true }).click();
  await page.getByRole("button", { name: "Compare the latest two runs" }).click();
  await expect(page.getByRole("status")).toContainText("Change one experimental factor before recording Run B");
  await page.getByLabel("Equal divisions", { exact: true }).fill("19");
  await page.getByLabel("Target numerator", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Record Run 3", exact: true }).click();
  await page.getByRole("button", { name: "Compare the latest two runs" }).click();
  await expect(page.getByRole("status")).toContainText("change one factor only. Changed: Equal divisions, Target numerator");
  await expect(page.locator(".mm-inquiry .mm-stage-card > h2")).toHaveText("Experiment");
});

test("12-EDO and 19-EDO record their real approximation errors", async ({ page }) => {
  await page.goto(".#/labs/pitch-tuning/lessons/temperaments-and-commas");
  await expect(page.getByRole("heading", { name: "Temperaments and Commas", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start with a prediction" }).click();
  const prediction = "More divisions will not necessarily reduce the selected ratio error.";
  await page.locator('[name="prediction"]').fill(prediction);
  await page.getByRole("button", { name: "Commit prediction & begin" }).click();
  const preview = page.locator(".mm-notebook-run--preview");
  await expect(preview).toContainText("Signed cents error");
  await expect(preview).toContainText("-1.96 cents");
  await page.getByRole("button", { name: "Record Run A", exact: true }).click();
  await page.getByLabel("Equal divisions", { exact: true }).fill("19");
  await expect(preview).toContainText("-7.22 cents");
  await page.getByRole("button", { name: "Record Run B", exact: true }).click();
  await page.getByRole("button", { name: "Compare the latest two runs" }).click();
  const observables = page.getByRole("region", { name: "Descriptive observables in the two latest runs" });
  await expect(observables.getByRole("row", { name: /Signed cents error -1\.96 cents -7\.22 cents/ })).toBeVisible();
  await expect(page.locator(".mm-notebook-prediction")).toContainText(prediction);
});

test("an invalid numeric draft cannot record the previous valid factor", async ({ page }, testInfo) => {
  const key = testInfo.project.name.startsWith("pages") ? demoKey : ordinaryKey;
  await unlock(page);
  const tempo = page.getByLabel("Tempo", { exact: true });
  await tempo.fill("");
  await expect(tempo).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText("Enter a number from 30 to 240");
  await page.getByRole("button", { name: "Record Run A", exact: true }).click();
  await expect(page.locator(".mm-notebook-run--recorded")).toHaveCount(0);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).attempts["phase-proportion:from-bpm-to-period"].trials, key)).toEqual([]);
  await tempo.fill("120");
  await page.getByRole("button", { name: "Record Run A", exact: true }).click();
  await expect(page.locator(".mm-notebook-run--recorded")).toContainText("120 BPM");
});

test("legacy migration stays confined to the ordinary portfolio", async ({ page }, testInfo) => {
  const legacy = {
    version: 1,
    lessonId: "latency",
    stage: "experiment",
    prediction: "A historical latency prediction.",
    runs: [{
      id: "Legacy run",
      durationSeconds: 1,
      config: {
        musicianCount: 8,
        tempoBpm: 132,
        tempoSpreadBpm: 5,
        couplingStrength: 1.6,
        latencySeconds: 0.075,
        jitterSeconds: 0,
        topology: "leader-follower",
        repertoireTexture: "dense-rhythm",
        clickTrackStrength: 0,
      },
      metrics: {
        coherence: 0.8,
        phaseSpread: 0.2,
        phaseSpreadEquivalentMs: 10,
        peerCouplingShare: 0.5,
        modelLatencyBudgetSeconds: 0.1,
        leaderToFollowerPhaseLagMs: 4,
        sectionCoherences: null,
      },
    }],
  };
  await page.evaluate(({ legacyKey, ordinaryKey, legacy }) => {
    localStorage.removeItem(ordinaryKey);
    localStorage.setItem(legacyKey, JSON.stringify(legacy));
  }, { legacyKey, ordinaryKey, legacy });
  await page.reload();

  if (testInfo.project.name.startsWith("pages")) {
    await expect(page.getByRole("heading", { name: "From BPM to Period", exact: true })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), ordinaryKey)).toBeNull();
  } else {
    await expect(page.getByRole("heading", { name: "From BPM to Period", exact: true })).toBeVisible();
    const migrated = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), ordinaryKey);
    const attempt = migrated.attempts["ensemble-dynamics:delay-jitter-topology"];
    expect(attempt.stage).toBe("experiment");
    expect(attempt.trials[0].factors.latencyMs).toBe(75);
    expect(attempt.trials[0].protocolId).toContain(".legacy-v1");
    const learningDialog = await openLearning(page);
    await expect(learningDialog.getByRole("link", { name: /Delay, Jitter, and Topology/ })).toContainText("experiment · 3 of 8");
  }
  expect(await page.evaluate((key) => localStorage.getItem(key), legacyKey)).toBe(JSON.stringify(legacy));
});

test("desktop and mobile render with isolated storage", async ({ page }, testInfo) => {
  await expect(page.getByRole("heading", { name: "From BPM to Period", exact: true })).toBeVisible();
  const pages = testInfo.project.name.startsWith("pages");
  const inactive = pages ? ordinaryKey : demoKey;
  await page.evaluate(({ inactive }) => localStorage.setItem(inactive, "untouched"), { inactive });
  await page.reload();
  await page.setViewportSize({ width: 1536, height: 1024 });
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/musica-${testInfo.project.name}-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "From BPM to Period", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/musica-${testInfo.project.name}-mobile.png` });
  expect(await page.evaluate((key) => localStorage.getItem(key), inactive)).toBe("untouched");
});

test("expanded ensemble controls render at every advertised extreme", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const lesson of ["lock-in-and-order", "delay-jitter-topology", "external-pulse-or-peer-adaptation"]) {
    await page.goto(`.#/labs/ensemble-dynamics/lessons/${lesson}`);
    await unlock(page);
    await openDetails(page, "Adjust other factors");
    const numbers = page.locator('.mm-factor-inspector input[type="number"]');
    for (let index = 0; index < await numbers.count(); index++) {
      const input = numbers.nth(index);
      for (const bound of ["min", "max"]) {
        const value = await input.getAttribute(bound);
        await input.fill(value!);
        await expect(input).toHaveValue(value!);
      }
    }
    if (lesson === "delay-jitter-topology") {
      for (const value of ["all-to-all", "leader-follower", "sections"]) {
        await page.getByLabel("Listening topology").selectOption(value);
      }
    }
    const model = await openDetails(page, "Explore the model, charts and playback");
    await expect(model.locator(".mm-result-visual svg")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("oversized raw storage disables automatic writes and displays recovery", async ({ page }, testInfo) => {
  const key = testInfo.project.name.startsWith("pages") ? demoKey : ordinaryKey;
  await page.addInitScript(({ key }) => {
    const raw = "x".repeat(8 * 1024 * 1024 + 1);
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    const writes: string[] = [];
    Object.assign(window, { portfolioWrites: writes });
    Storage.prototype.getItem = function (name) { return name === key ? raw : originalGet.call(this, name); };
    Storage.prototype.setItem = function (name, value) {
      if (name === key) writes.push(value);
      originalSet.call(this, name, value);
    };
  }, { key });
  await page.reload();
  await expect(page.getByRole("status")).toContainText("Stored learning data is too large");
  const footerStatus = page.locator(".mm-notebook-footer .mm-global-status");
  await expect(footerStatus).toContainText("Automatic saving off");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dismiss message" }).click();
  await expect(footerStatus.getByText("Automatic saving off", { exact: true })).toBeVisible();
  await unlock(page);
  await expect(page.getByRole("button", { name: /Record Run A/ })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { portfolioWrites: string[] }).portfolioWrites)).toEqual([]);
  expect(await page.evaluate((key) => localStorage.getItem(key)?.length, key)).toBe(8 * 1024 * 1024 + 1);
});

test("storage failures are visible in ordinary and demo adapters", async ({ page }, testInfo) => {
  const key = testInfo.project.name.startsWith("pages") ? demoKey : ordinaryKey;
  await page.addInitScript(({ key }) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("Quota exceeded", "QuotaExceededError");
      original.call(this, name, value);
    };
  }, { key });
  await page.reload();
  await expect(page.getByRole("status")).toContainText("Browser storage is unavailable");
  const footerStatus = page.locator(".mm-notebook-footer .mm-global-status");
  await expect(footerStatus).toContainText("Saving unavailable");
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.getByRole("button", { name: "Dismiss message" }).click();
  await expect(footerStatus.getByText("Saving unavailable", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(footerStatus.getByText("Saving unavailable", { exact: true })).toBeVisible();
});

test("oversized valid records are trimmed with a notice and endpoint preservation", async ({ page }, testInfo) => {
  const key = testInfo.project.name.startsWith("pages") ? demoKey : ordinaryKey;
  await unlock(page);
  await page.getByRole("button", { name: /Record Run A/ }).click();
  await page.evaluate(({ key }) => {
    const portfolio = JSON.parse(localStorage.getItem(key)!);
    const attempt = portfolio.attempts["phase-proportion:from-bpm-to-period"];
    attempt.prediction = "🎵".repeat(16_385);
    attempt.trials[0].trace = Array.from({ length: 1024 }, (_, x) => ({ x, y: x / 1024, series: "trace" }));
    localStorage.setItem(key, JSON.stringify(portfolio));
  }, { key });
  await page.reload();
  await expect(page.getByRole("status")).toContainText("trimmed");
  const attempt = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).attempts["phase-proportion:from-bpm-to-period"], key);
  expect(Array.from(attempt.prediction)).toHaveLength(16_384);
  expect(attempt.trials[0].trace).toHaveLength(256);
  expect(attempt.trials[0].trace[0].x).toBe(0);
  expect(attempt.trials[0].trace.at(-1).x).toBe(1023);
});

test("new oversized learner text is trimmed without blocking inquiry", async ({ page }, testInfo) => {
  const key = testInfo.project.name.startsWith("pages") ? demoKey : ordinaryKey;
  if (!await page.getByRole("button", { name: "Start with a prediction" }).count()) {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Restart lesson", exact: true }).click();
  }
  await page.getByRole("button", { name: "Start with a prediction" }).click();
  await page.locator('[name="prediction"]').fill("🎵".repeat(16_385));
  await page.getByRole("button", { name: "Commit prediction & begin" }).click();
  await expect(page.getByRole("button", { name: /Record Run A/ })).toBeVisible();
  await expect(page.locator(".mm-global-message")).toContainText("trimmed");
  await openDetails(page, "Add an optional observation note");
  await page.getByLabel("Optional observation note").fill("🎵".repeat(16_385));
  await page.getByRole("button", { name: /Record Run A/ }).click();
  await expect(page.locator(".mm-global-message")).toContainText("trimmed");
  const attempt = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).attempts["phase-proportion:from-bpm-to-period"], key);
  expect(attempt.stage).toBe("experiment");
  expect(Array.from(attempt.prediction)).toHaveLength(16_384);
  expect(Array.from(attempt.trials[0].note)).toHaveLength(16_384);
});

test("mobile notebook prioritizes the task and supports dialog keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  if (!await page.getByRole("button", { name: "Start with a prediction" }).count()) {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Restart lesson", exact: true }).click();
  }
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.getByRole("button", { name: "Start with a prediction" })).toBeInViewport();
  const lessons = page.getByRole("button", { name: "Lessons", exact: true });
  await lessons.click();
  const lessonsDialog = page.getByRole("dialog", { name: "Choose your inquiry" });
  await expect(lessonsDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(lessonsDialog).not.toBeVisible();
  await expect(lessons).toBeFocused();
  await lessons.click();
  await lessonsDialog.locator('.mm-curriculum-rail__lesson[href$="/lessons/polyrhythm-return-times"]').click();
  await expect(page.locator("#mm-current-task")).toBeFocused();
  await expect(lessonsDialog).not.toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "From BPM to Period", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start with a prediction" }).click();
  await expect(page.locator(".mm-inquiry .mm-stage-card > h2")).toBeFocused();
  await expect(page.getByRole("navigation", { name: "Inquiry progress" }).locator('[aria-current="step"]')).toContainText("Predict");
  await page.locator('[name="prediction"]').fill("Doubling tempo halves the period of each beat.");
  await page.getByRole("button", { name: "Commit prediction & begin" }).click();
  await expect(page.locator(".mm-inquiry .mm-stage-card > h2")).toBeFocused();
  await expect(page.getByLabel("Tempo", { exact: true })).toBeEnabled();
  const learningDialog = await openLearning(page);
  await learningDialog.getByRole("button", { name: "Presentation mode" }).click();
  await expect(learningDialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Exit presentation" })).toBeVisible();
  await page.getByRole("button", { name: "Exit presentation" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("all lessons fit the notebook across mobile, tablet and desktop widths", async ({ page }) => {
  await ensureFreshAttempt(page);
  const routes = await page.locator(".mm-curriculum-rail__lesson").evaluateAll((links) => links.map((link) => link.getAttribute("href")!));
  expect(routes).toHaveLength(24);
  for (let index = 0; index < routes.length; index++) {
    const viewport = [{ width: 390, height: 844 }, { width: 768, height: 1000 }, { width: 1536, height: 1024 }][index % 3];
    await page.setViewportSize(viewport);
    await page.goto(`.${routes[index]}`);
    await expect(page.locator("#mm-current-task h1")).toBeVisible();
    await expect(page.locator(".mm-factor-inspector")).toHaveCount(0);
    await expect(page.locator(".mm-result-visual")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Inquiry progress" }).locator('[aria-current="step"]')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), routes[index]).toBe(true);
  }
});
