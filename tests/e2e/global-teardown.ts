import {
	clearE2eApplicationData,
	requireE2eDatabaseUrl,
} from "./e2e-database-safety";

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
