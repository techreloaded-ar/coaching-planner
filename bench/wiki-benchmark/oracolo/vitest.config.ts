import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "vitest/config";

const radice = path.resolve(__dirname, "..");
loadEnvConfig(radice);

export default defineConfig({
	root: radice,
	test: {
		globals: true,
		environment: "node",
		include: ["__oracolo__/integrazione.test.ts"],
		fileParallelism: false,
		testTimeout: 60_000,
		hookTimeout: 60_000,
	},
	resolve: {
		alias: {
			"@": path.resolve(radice, "src"),
			"server-only": path.resolve(radice, "tests/unit/__mocks__/server-only.ts"),
		},
	},
});
