import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
const root = path.resolve(__dirname, "../..");
const python = path.join(
  root,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 12000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3001",
    timezoneId: "Europe/Rome",
    locale: "it-IT",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : {}),
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: [
    {
      command: `"${python}" scripts/browser_test_backend.py`,
      cwd: root,
      url: "http://127.0.0.1:8001/api/v1/auth/csrf/",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "npm run dev -- --port 3001",
      url: "http://127.0.0.1:3001/login",
      reuseExistingServer: false,
      timeout: 60000,
      env: { BACKEND_URL: "http://127.0.0.1:8001" },
    },
  ],
});
