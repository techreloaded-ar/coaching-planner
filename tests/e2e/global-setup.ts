import { execSync } from "node:child_process";

import {
	assertDatabaseE2eDistintoDaDatabaseApplicativo,
	costruisciAmbienteE2e,
	garantisciDatabaseE2eEsistente,
	requireE2eDatabaseUrl,
	ripristinaSchemaPulitoDatabaseE2e,
} from "./e2e-database-safety";

/**
 * Playwright global setup: prepara da sé il database dedicato alla suite e2e.
 *
 * La preparazione non richiede un database vuoto: lo rende vuoto. A ogni run lo
 * schema viene ricreato da zero, quindi nessun test può contare su dati residui
 * del run precedente e un run interrotto non blocca quelli successivi.
 * L'operazione è distruttiva, perciò è preceduta dalla guardia d'identità che
 * rifiuta un database e2e coincidente con quello applicativo.
 *
 * Il seed è una baseline read-only/smoke: i test che mutano dati devono creare
 * righe proprie tramite fixture/factory con namespace univoco. Non facciamo
 * cleanup per-test mentre i worker girano in parallelo; la pulizia ordinaria è
 * centralizzata nel globalTeardown.
 */
async function globalSetup() {
	const e2eDatabaseUrl = requireE2eDatabaseUrl();
	const ambienteE2e = costruisciAmbienteE2e(process.env, e2eDatabaseUrl);

	try {
		console.log(
			"🔒 Verifica che il database e2e sia distinto da quello applicativo...",
		);
		assertDatabaseE2eDistintoDaDatabaseApplicativo(
			e2eDatabaseUrl,
			process.env.DATABASE_URL,
		);
		console.log("✅ Database e2e dedicato: nessuna coincidenza rilevata.");

		console.log("🗄️ Verifica esistenza del database e2e...");
		await garantisciDatabaseE2eEsistente(e2eDatabaseUrl);
		console.log("✅ Database e2e disponibile.");

		console.log("♻️ Ripristino dello stato pulito del database e2e...");
		await ripristinaSchemaPulitoDatabaseE2e(e2eDatabaseUrl);
		console.log("✅ Schema del database e2e ricreato da zero.");

		console.log("🗃️ Applicazione migrazioni database e2e...");
		execSync("npm run db:migrate:deploy", {
			cwd: process.cwd(),
			stdio: "inherit",
			env: ambienteE2e,
		});
		console.log("✅ Migrazioni completate.");

		console.log("🌱 Esecuzione seed database e2e...");
		execSync("npm run db:seed", {
			cwd: process.cwd(),
			stdio: "inherit",
			env: ambienteE2e,
		});
		console.log("✅ Seed completato.");
	} catch (error) {
		console.error("❌ Errore durante la preparazione del database e2e:", error);
		throw error;
	}
}

export default globalSetup;
