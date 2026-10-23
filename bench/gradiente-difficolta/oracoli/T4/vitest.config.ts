// Oracolo · livello integrazione. Installato in <consegna>/__oracolo__/vitest.config.ts.
// Env richiesto: DATABASE_URL = E2E_DATABASE_URL = database Postgres dedicato, migrato e con seed.
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "vitest/config";

const radice = path.resolve(__dirname, "..");
loadEnvConfig(radice);
// Il server e la CI girano in UTC: stessa condizione per le funzioni chiamate in-process.
process.env.TZ = "UTC";
const segretoSessione =
	(process.env.SESSION_SECRET?.trim().length ?? 0) >= 32
		? process.env.SESSION_SECRET!
		: "oracolo-session-secret-solo-per-test-0123456789abcdef";

export default defineConfig({
	root: radice,
	test: {
		globals: true,
		environment: "node",
		include: ["__oracolo__/integrazione.test.ts"],
		setupFiles: ["__oracolo__/shared/setup-integrazione.ts"],
		env: { TZ: "UTC", SESSION_SECRET: segretoSessione },
		fileParallelism: false,
		testTimeout: 120_000,
		hookTimeout: 120_000,
	},
	resolve: {
		alias: {
			"@": path.resolve(radice, "src"),
			"server-only": path.resolve(radice, "tests/unit/__mocks__/server-only.ts"),
		},
	},
});
