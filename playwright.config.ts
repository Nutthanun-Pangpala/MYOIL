import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/** key for the BookCare API specs; only a dev server started by Playwright gets it (stop any server you started by hand) */
export const TEST_PUSH_KEY = "e2e-bookcare-push-key-0123456789abcdef0123456789";

/**
 * End-to-end tests run against a real dev server and the real local Postgres (`npm run db:up` first).
 * Each spec file reseeds the DB (`npm run db:seed` WIPES all fuel data) — never point DATABASE_URL at a shared database.
 * One worker: the specs share one database.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    env: { BOOKCARE_PUSH_KEY: TEST_PUSH_KEY },
    timeout: 120_000,
  },
});
