import { defineConfig, devices } from "@playwright/test";

const builds = [
  { name: "root", port: 4173, base: "/", build: "build" },
  { name: "pages", port: 4174, base: "/musica-mathematica/", build: "build:pages" },
];
const browsers = [
  { name: "chromium", device: "Desktop Chrome" },
  { name: "firefox", device: "Desktop Firefox" },
  { name: "webkit", device: "Desktop Safari" },
];
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 3,
  reporter: "list",
  use: { trace: "retain-on-failure" },
  projects: builds.flatMap((build) => browsers.map((browser) => ({
    name: `${build.name}-${browser.name}`,
    use: { ...devices[browser.device], baseURL: `http://127.0.0.1:${build.port}${build.base}` },
  }))),
  webServer: builds.map((build) => ({
    // `--outDir` is appended to the script, so `vite build` must remain the last
    // command of the `build` and `build:pages` scripts in package.json.
    command: `pnpm ${build.build} --outDir .playwright-results/${build.name} && pnpm exec vite preview --host 127.0.0.1 --port ${build.port} --strictPort --outDir .playwright-results/${build.name}${build.name === "pages" ? " --mode pages" : ""}`,
    url: `http://127.0.0.1:${build.port}${build.base}`,
    reuseExistingServer: false,
    timeout: 120_000,
  })),
});
