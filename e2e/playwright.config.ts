/**
 * Automatic click-through tests. They open the studio in a real browser, click through every
 * tool and the main song flow, and fail if anything crashes. AI answers are canned
 * (BB_FAKE_AI=1), so a run costs nothing and gives the same result every time.
 *
 *   npx playwright test -c e2e          run everything
 *   npx playwright test -c e2e --ui     watch it click
 *
 * GitHub runs this on every push (.github/workflows/tests.yml).
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: ".",
  outputDir: "../test-results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env["CI"] ? 2 : 3,
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never", outputFolder: "../playwright-report" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    acceptDownloads: true,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"] }, grep: /@phone/ },
  ],
  webServer: {
    command: `npx vite dev --port ${PORT} --host 127.0.0.1 --strictPort`,
    cwd: "..",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
    env: { BB_FAKE_AI: "1" },
  },
});
