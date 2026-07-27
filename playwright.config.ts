import { defineConfig, devices } from "@playwright/test";

const e2eUrl = "http://127.0.0.1:4174";

export default defineConfig({
  fullyParallel: false,
  outputDir: ".playwright-results",
  reporter: "list",
  testDir: "./tests/e2e",
  use: {
    baseURL: e2eUrl,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174 --strictPort",
    reuseExistingServer: false,
    timeout: 120_000,
    url: e2eUrl,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
