// T3 · controlli M1–M3: gira sulla copia della consegna con oracolo e adattatore installati,
// dopo la fase «prima» e `prisma migrate deploy`. Lanciato da migrazione_con_dati.py.
// Env: DATABASE_URL = E2E_DATABASE_URL = database della migrazione, ORACOLO_FOTO_PRIMA = foto della baseline.
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "vitest/config";

const radice = path.resolve(__dirname, "../..");
loadEnvConfig(radice);
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
		include: ["__oracolo__/migrazione/migrazione.test.ts"],
		setupFiles: ["__oracolo__/shared/setup-integrazione.ts"],
		env: { TZ: "UTC", SESSION_SECRET: segretoSessione },
		fileParallelism: false,
		testTimeout: 600_000,
		hookTimeout: 120_000,
	},
	resolve: {
		alias: {
			"@": path.resolve(radice, "src"),
			"server-only": path.resolve(radice, "tests/unit/__mocks__/server-only.ts"),
		},
	},
});
