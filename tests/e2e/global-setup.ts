import { execSync } from "node:child_process";
import type { FullConfig } from "@playwright/test";

/**
 * Playwright global setup: esegue il seed del database prima della suite e2e.
 */
async function globalSetup(_config: FullConfig) {
  console.log("🌱 Esecuzione seed database...");
  try {
    execSync("npx prisma db seed", {
      cwd: process.cwd(),
      stdio: "inherit",
      env: { ...process.env },
    });
    console.log("✅ Seed completato.");
  } catch (error) {
    console.error("❌ Errore durante il seed:", error);
    throw error;
  }
}

export default globalSetup;
