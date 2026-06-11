import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL non è configurata. " +
        "Copia .env.example in .env.local e imposta la stringa di connessione PostgreSQL."
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

/**
 * Singleton Prisma Client condiviso per l'applicazione.
 *
 * In development, Next.js hot-reloading ricrea i moduli a ogni richiesta.
 * Senza il singleton, ogni ricaricamento creerebbe una nuova connessione
 * al database, esaurendo rapidamente il pool di connessioni.
 * In produzione viene creata una singola istanza.
 */
export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
