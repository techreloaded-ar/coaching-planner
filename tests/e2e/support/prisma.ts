import pg from "pg";

function requireE2eDatabaseUrl(): string {
	const e2eDatabaseUrl = process.env.E2E_DATABASE_URL?.trim();

	if (!e2eDatabaseUrl) {
		throw new Error(
			"E2E_DATABASE_URL is required to create the Playwright database client.",
		);
	}

	return e2eDatabaseUrl;
}

function createE2eDatabasePool(): pg.Pool {
	return new pg.Pool({ connectionString: requireE2eDatabaseUrl() });
}

const globalForE2eDatabase = globalThis as unknown as {
	e2eDatabasePool?: pg.Pool;
};

/**
 * Database pool for Playwright support code.
 *
 * It intentionally reads only E2E_DATABASE_URL. Do not fall back to DATABASE_URL:
 * the e2e data layer must never point at the application database by accident.
 *
 * Note: this uses pg directly because the generated Prisma TS client currently
 * fails when loaded by Playwright's Node transform pipeline. Keep the access
 * behind this module so it can be swapped back to PrismaPg when that is fixed.
 */
export const e2ePrisma =
	globalForE2eDatabase.e2eDatabasePool ?? createE2eDatabasePool();

globalForE2eDatabase.e2eDatabasePool = e2ePrisma;

export type E2ePrismaClient = pg.Pool;
