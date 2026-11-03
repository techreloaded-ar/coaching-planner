// Controlli prima di partire, per fermarsi subito con un messaggio chiaro invece che a
// metà import con un "Cannot read properties of undefined (reading 'findMany')": il
// client Prisma generato deve conoscere tutti i modelli dello schema e il database
// indicato nella configurazione deve avere tutte le migrazioni del progetto.

import { readdirSync, readFileSync } from "node:fs";
import type { PrismaClient } from "../../src/generated/prisma/client";

const PERCORSO_SCHEMA = "prisma/schema.prisma";
const CARTELLA_MIGRAZIONI = "prisma/migrations";

/** I modelli letti dallo schema, non dal client: è proprio il client che potrebbe essere vecchio. */
export function verificaClientPrisma(prisma: PrismaClient): void {
  const modelli = [...readFileSync(PERCORSO_SCHEMA, "utf8").matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]);
  const mancanti = modelli.filter((nome) => (prisma as unknown as Record<string, unknown>)[nome[0].toLowerCase() + nome.slice(1)] === undefined);
  if (mancanti.length > 0) {
    throw new Error(
      `Il client Prisma generato non conosce i modelli: ${mancanti.join(", ")}.\n` +
        `  È più vecchio di ${PERCORSO_SCHEMA}: rigeneralo con "npm run db:generate".`,
    );
  }
}

export async function verificaMigrazioni(prisma: PrismaClient): Promise<void> {
  const attese = readdirSync(CARTELLA_MIGRAZIONI, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const comeApplicarle = `  Applicale al database della configurazione con: DATABASE_URL="<DATABASE_URL del file di configurazione>" npm run db:migrate:deploy`;

  const [{ esiste }] = await prisma.$queryRaw<{ esiste: boolean }[]>`SELECT to_regclass('_prisma_migrations') IS NOT NULL AS esiste`;
  if (!esiste) throw new Error(`Il database non ha ancora nessuna migrazione (manca la tabella _prisma_migrations).\n${comeApplicarle}`);

  const applicate = new Set(
    (await prisma.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`).map((r) => r.migration_name),
  );
  const mancanti = attese.filter((nome) => !applicate.has(nome));
  if (mancanti.length > 0) throw new Error(`Al database mancano ${mancanti.length} migrazioni, a partire da ${mancanti[0]}.\n${comeApplicarle}`);
}
