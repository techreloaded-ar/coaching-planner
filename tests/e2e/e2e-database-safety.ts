import pg from "pg";

const PUBLIC_SCHEMA = "public";
const PRISMA_MIGRATIONS_TABLE = "_prisma_migrations";

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

function formatQualifiedTableName(tableName: string): string {
	return `${quoteIdentifier(PUBLIC_SCHEMA)}.${quoteIdentifier(tableName)}`;
}

async function withDatabaseClient<T>(
	connectionString: string,
	callback: (client: pg.Client) => Promise<T>,
): Promise<T> {
	const client = new pg.Client({ connectionString });

	await client.connect();

	try {
		return await callback(client);
	} finally {
		await client.end();
	}
}

async function listApplicationTables(client: pg.Client): Promise<string[]> {
	const result = await client.query<{ table_name: string }>(
		`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
      AND table_name <> $2
    ORDER BY table_name ASC
  `,
		[PUBLIC_SCHEMA, PRISMA_MIGRATIONS_TABLE],
	);

	return result.rows.map(({ table_name }) => table_name);
}

export function requireE2eDatabaseUrl(): string {
	const e2eDatabaseUrl = process.env.E2E_DATABASE_URL?.trim();

	if (!e2eDatabaseUrl) {
		throw new Error(
			"E2E_DATABASE_URL is required for end-to-end database operations.",
		);
	}

	return e2eDatabaseUrl;
}

export async function assertE2eDatabaseHasNoApplicationData(
	connectionString: string,
): Promise<void> {
	await withDatabaseClient(connectionString, async (client) => {
		const applicationTables = await listApplicationTables(client);

		if (applicationTables.length === 0) {
			return;
		}

		const tablesWithData: Array<{ tableName: string; rowCount: number }> = [];

		for (const tableName of applicationTables) {
			const result = await client.query<{ row_count: string }>(
				`SELECT COUNT(*)::text AS row_count FROM ${formatQualifiedTableName(tableName)}`,
			);
			const rowCount = Number(result.rows[0]?.row_count ?? "0");

			if (rowCount > 0) {
				tablesWithData.push({ tableName, rowCount });
			}
		}

		if (tablesWithData.length === 0) {
			return;
		}

		const details = tablesWithData
			.map(
				({ tableName, rowCount }) =>
					`${formatQualifiedTableName(tableName)}: ${rowCount}`,
			)
			.join(", ");

		throw new Error(
			`E2E database safety check failed: E2E_DATABASE_URL must point to an empty dedicated e2e database. Application data found in ${details}.`,
		);
	});
}

export async function clearE2eApplicationData(
	connectionString: string,
): Promise<void> {
	await withDatabaseClient(connectionString, async (client) => {
		const applicationTables = await listApplicationTables(client);

		if (applicationTables.length === 0) {
			return;
		}

		const qualifiedTableNames = applicationTables
			.map((tableName) => formatQualifiedTableName(tableName))
			.join(", ");

		await client.query(
			`TRUNCATE TABLE ${qualifiedTableNames} RESTART IDENTITY CASCADE`,
		);
	});
}
