import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";
import { validaSessionSecret } from "./src/lib/session-config";
import {
	assertDatabaseE2eDistintoDaDatabaseApplicativo,
	costruisciAmbienteE2e,
} from "./tests/e2e/e2e-database-safety";

loadEnvConfig(process.cwd());

const e2eDatabaseUrl = process.env.E2E_DATABASE_URL?.trim();

if (!e2eDatabaseUrl) {
	throw new Error(
		"E2E_DATABASE_URL is required to run Playwright end-to-end tests.",
	);
}

// La configurazione è il primo codice valutato da Playwright, prima del
// globalSetup e prima dell'avvio del web server: qui il rifiuto avviene senza
// che alcun processo abbia toccato dati.
assertDatabaseE2eDistintoDaDatabaseApplicativo(
	e2eDatabaseUrl,
	process.env.DATABASE_URL,
);

const webServerCommand =
	process.env.PLAYWRIGHT_WEB_SERVER_COMMAND?.trim() || "npm run dev";

// Porta del web server e2e: E2E_PORT permette di eseguire la suite mentre un
// altro server di sviluppo occupa la 3000 (next dev legge PORT).
const portaE2e = process.env.E2E_PORT?.trim() || "3000";
const urlE2e = `http://localhost:${portaE2e}`;

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
	...costruisciAmbienteE2e(process.env, e2eDatabaseUrl),
	// Il fallback vale solo per il processo web server lanciato da Playwright.
	SESSION_SECRET: e2eSessionSecret,
	PORT: portaE2e,
};

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	retries: 1,
	reporter: "html",
	globalSetup: "./tests/e2e/global-setup.ts",
	globalTeardown: "./tests/e2e/global-teardown.ts",
	use: {
		baseURL: urlE2e,
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
		url: urlE2e,
		reuseExistingServer: false,
	},
});
