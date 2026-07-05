import {
	clearE2eApplicationData,
	requireE2eDatabaseUrl,
} from "./e2e-database-safety";

/**
 * Cleanup finale della suite e2e.
 *
 * È intenzionalmente globale e non concorrente: durante la suite l'isolamento è
 * garantito da namespace, mesi/intervalli riservati e relazioni proprie dei
 * test, non da cancellazioni per-test che potrebbero interferire fra worker.
 */
async function globalTeardown() {
	const e2eDatabaseUrl = requireE2eDatabaseUrl();

	try {
		console.log("🧹 Pulizia finale del database e2e...");
		await clearE2eApplicationData(e2eDatabaseUrl);
		console.log("✅ Database e2e ripulito.");
	} catch (error) {
		console.error(
			"❌ Errore durante la pulizia finale del database e2e:",
			error,
		);
		throw error;
	}
}

export default globalTeardown;
