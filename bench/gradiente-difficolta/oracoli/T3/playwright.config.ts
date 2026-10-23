// Oracolo · livello browser. Installato in <consegna>/__oracolo__/playwright.config.ts.
// Avvia `next start` della build già prodotta dal gate CI. Env: DATABASE_URL = E2E_DATABASE_URL.
// Server in UTC come la CI; browser in Europe/Rome e it-IT (condizione fissata prima delle prove).
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

const radice = path.resolve(__dirname, "..");
loadEnvConfig(radice);
const porta = Number(process.env.ORACOLO_PORTA ?? 3000);
const baseURL = `http://localhost:${porta}`;
const segretoSessione =
	(process.env.SESSION_SECRET?.trim().length ?? 0) >= 32
		? process.env.SESSION_SECRET!
		: "oracolo-session-secret-solo-per-test-0123456789abcdef";

export default defineConfig({
	testDir: ".",
	testMatch: "browser.spec.ts",
	fullyParallel: true,
	retries: 0,
	timeout: 120_000,
	expect: { timeout: 15_000 },
	reporter: [["json", { outputFile: process.env.ORACOLO_PLAYWRIGHT_JSON ?? "playwright-oracolo.json" }], ["line"]],
	use: {
		...devices["Desktop Chrome"],
		baseURL,
		viewport: { width: 1440, height: 900 },
		timezoneId: "Europe/Rome",
		locale: "it-IT",
		trace: "retain-on-failure",
	},
	webServer: {
		command: `npx next start -p ${porta}`,
		cwd: radice,
		url: baseURL,
		reuseExistingServer: false,
		timeout: 180_000,
		env: { E2E_TEST_MODE: "true", TZ: "UTC", SESSION_SECRET: segretoSessione },
	},
});
