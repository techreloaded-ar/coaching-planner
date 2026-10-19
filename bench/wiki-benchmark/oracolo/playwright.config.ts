import { defineConfig, devices } from "@playwright/test";

const porta = 3000;

export default defineConfig({
	testDir: ".",
	testMatch: "browser.spec.ts",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 90_000,
	expect: { timeout: 10_000 },
	reporter: [["json", { outputFile: process.env.ORACOLO_PLAYWRIGHT_JSON ?? "playwright-oracolo.json" }]],
	use: { baseURL: `http://localhost:${porta}`, ...devices["Desktop Chrome"] },
	webServer: {
		command: `npx next start -p ${porta}`,
		cwd: "..",
		url: `http://localhost:${porta}`,
		reuseExistingServer: false,
		timeout: 120_000,
		env: { E2E_TEST_MODE: "true" },
	},
});
