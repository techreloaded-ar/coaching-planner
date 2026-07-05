import { execSync } from "node:child_process";

import {
	assertE2eDatabaseHasNoApplicationData,
	requireE2eDatabaseUrl,
} from "./e2e-database-safety";

/**
 * Playwright global setup: allinea schema e dati del database prima della suite e2e.
 *
 * Il seed è una baseline read-only/smoke: i test che mutano dati devono creare
 * righe proprie tramite fixture/factory con namespace univoco. Non facciamo
 * cleanup per-test mentre i worker girano in parallelo; la pulizia ordinaria è
 * centralizzata nel globalTeardown.
 */
async function globalSetup() {
	const e2eDatabaseUrl = requireE2eDatabaseUrl();
	const e2eEnvironment = {
		...process.env,
		DATABASE_URL: e2eDatabaseUrl,
		E2E_DATABASE_URL: e2eDatabaseUrl,
		E2E_TEST_MODE: "true",
	};

	try {
		console.log("🔒 Verifica che il database e2e sia vuoto...");
		await assertE2eDatabaseHasNoApplicationData(e2eDatabaseUrl);
		console.log("✅ Database e2e pronto: nessun dato applicativo presente.");

		console.log("🗃️ Applicazione migrazioni database e2e...");
		execSync("npm run db:migrate:deploy", {
			cwd: process.cwd(),
			stdio: "inherit",
			env: e2eEnvironment,
		});
		console.log("✅ Migrazioni completate.");

		console.log("🌱 Esecuzione seed database e2e...");
		execSync("npm run db:seed", {
			cwd: process.cwd(),
			stdio: "inherit",
			env: e2eEnvironment,
		});
		console.log("✅ Seed completato.");
	} catch (error) {
		console.error("❌ Errore durante la preparazione del database e2e:", error);
		throw error;
	}
}

export default globalSetup;
