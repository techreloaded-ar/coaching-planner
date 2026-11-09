import { defineConfig, devices } from "@playwright/test";
import { assertDatabaseE2eDistintoDaDatabaseApplicativo, costruisciAmbienteE2e } from "../e2e/e2e-database-safety";

const database = process.env.E2E_DATABASE_URL;
if (!database) throw new Error("Occorre E2E_DATABASE_URL per un database locale dedicato.");
const parsed = new URL(database);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.pathname !== "/importer_browser_e2e") throw new Error("Richiesto il database locale importer_browser_e2e.");
assertDatabaseE2eDistintoDaDatabaseApplicativo(database, process.env.DATABASE_URL);
const port = process.env.E2E_PORT || "3108";
export default defineConfig({
  testDir: ".", testMatch: "importer-browser.spec.ts", fullyParallel: true, retries: 0,
  globalSetup: "../e2e/global-setup.ts", globalTeardown: "../e2e/global-teardown.ts",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  use: { baseURL: `http://localhost:${port}` },
  webServer: { command: "npm run start", url: `http://localhost:${port}`, reuseExistingServer: false,
    env: { ...costruisciAmbienteE2e(process.env, database), PORT: port,
      SESSION_SECRET: "importer-browser-session-secret-with-at-least-32-characters",
      IMPORTER_GOOGLE_SPREADSHEET_ID: "e2e-importer",
      IMPORTER_GOOGLE_SERVICE_ACCOUNT_JSON: "test-fixture-no-network", IMPORTER_AI_BASE_URL: "", IMPORTER_AI_API_KEY: "", IMPORTER_AI_MODEL: "" } },
});
