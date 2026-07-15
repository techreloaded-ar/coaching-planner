import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";
import { validaSessionSecret } from "./src/lib/session-config";

loadEnvConfig(process.cwd());

const e2eDatabaseUrl = process.env.E2E_DATABASE_URL?.trim();

if (!e2eDatabaseUrl) {
	throw new Error(
		"E2E_DATABASE_URL is required to run Playwright end-to-end tests.",
	);
}

const webServerCommand =
	process.env.PLAYWRIGHT_WEB_SERVER_COMMAND?.trim() || "npm run dev";

const E2E_FALLBACK_SESSION_SECRET =
	"e2e-test-session-secret-not-for-production-1234567890";

function resolveE2ESessionSecret(secret: string | undefined) {
	try {
		return validaSessionSecret(secret);
	} catch {
		return validaSessionSecret(E2E_FALLBACK_SESSION_SECRET);
	}
}

const e2eSessionSecret = resolveE2ESessionSecret(process.env.SESSION_SECRET);

const e2eEnvironment = {
	...process.env,
	DATABASE_URL: e2eDatabaseUrl,
	E2E_DATABASE_URL: e2eDatabaseUrl,
	E2E_TEST_MODE: "true",
	// Il fallback vale solo per il processo web server lanciato da Playwright.
	SESSION_SECRET: e2eSessionSecret,
};

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	retries: 1,
	reporter: "html",
	globalSetup: "./tests/e2e/global-setup.ts",
	globalTeardown: "./tests/e2e/global-teardown.ts",
	use: {
		baseURL: "http://localhost:3000",
		video: "off", // Default off; solo il demo scenario abilita la registrazione
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: webServerCommand,
		env: e2eEnvironment,
		url: "http://localhost:3000",
		reuseExistingServer: false,
	},
});
