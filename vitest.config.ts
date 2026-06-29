import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "vitest/config";

loadEnvConfig(process.cwd());

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["tests/unit/**/*.test.ts"],
		server: {
			deps: {
				inline: [],
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"server-only": path.resolve(
				__dirname,
				"./tests/unit/__mocks__/server-only.ts",
			),
		},
	},
});
