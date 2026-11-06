import path from "node:path";
import { defineConfig } from "vitest/config";

const url = process.env.IMPORTER_TEST_DATABASE_URL;
if (!url) throw new Error("IMPORTER_TEST_DATABASE_URL deve indicare un database locale dedicato e sacrificabile.");
const parsed = new URL(url);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.pathname !== "/importer_test") throw new Error("I test distruttivi dell’importer richiedono un database locale chiamato importer_test.");
process.env.DATABASE_URL = url;
export default defineConfig({
  test: { include: ["tests/integration/importer-legacy.test.ts"], fileParallelism: false },
  resolve: { alias: { "@": path.resolve(__dirname, "../../src"), "server-only": path.resolve(__dirname, "../unit/__mocks__/server-only.ts") } },
});
