import { defineConfig } from "@playwright/test";

export default defineConfig({
  // Keep Lab 3 regression coverage while allowing the Lab 4 suite to be
  // selected independently by `npm run test:lab4`. Helpers do not use the
  // `.spec.ts` suffix and therefore are not discovered as runnable tests.
  testDir: ".",
  testMatch: ["lab-03/**/*.spec.ts", "lab-04/**/*.spec.ts"],
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]] : "list",
  webServer: {
    command: "npm --prefix ../client run dev -- --host 127.0.0.1",
    url: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    // CI uses its pinned Chromium; local Windows runs may use an installed
    // Chrome when the Playwright browser download is unavailable.
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: "test-results",
});
