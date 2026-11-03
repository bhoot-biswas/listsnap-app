import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * The smoke run (pnpm e2e): the built app (pnpm build first) with every outside service
 * mocked, driven in a phone-sized browser the way a seller uses it. Not port 3000: on the
 * server that is the live site. E2E_CHROME points at a Chrome already on the machine
 * instead of Playwright's own download.
 */
// The app it starts reads .env.local, and the run makes demo shops in that database: like
// the DB tests, only a *_test one (GitHub Actions' throwaway service aside).
try {
  process.loadEnvFile(".env.local");
} catch {}
const db = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).pathname.slice(1) : "";
if (db && !db.endsWith("_test") && process.env.GITHUB_ACTIONS !== "true")
  throw new Error(`The smoke run only uses a database whose name ends in _test, not "${db}".`);

const PORT = Number(process.env.E2E_PORT ?? 3210);
const base = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: base,
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
    launchOptions: process.env.E2E_CHROME ? { executablePath: process.env.E2E_CHROME } : {},
  },
  webServer: {
    command: `pnpm exec next start -p ${PORT} -H 127.0.0.1`,
    // not /api/health: without production secrets it answers 503 "config incomplete"
    url: `${base}/sign-in`,
    timeout: 60_000,
    reuseExistingServer: false,
    env: {
      BETTER_AUTH_URL: base,
      MEDIA_DIR: mkdtempSync(path.join(tmpdir(), "listsnap-e2e-media-")),
      PROVIDER_MODE_META: "mock",
      PROVIDER_MODE_WOO: "mock",
      PROVIDER_MODE_SHOPIFY: "mock",
      PROVIDER_MODE_INSTAGRAM: "mock",
      PROVIDER_MODE_FACEBOOK: "mock",
      PROVIDER_MODE_VIDEO: "mock",
      PROVIDER_MODE_BASETEN: "mock",
      MOCK_DELAY_MS: "0",
    },
  },
});
