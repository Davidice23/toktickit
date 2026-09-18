import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./lab-03",
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
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: "test-results",
});
