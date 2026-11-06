-- Metadati temporanei e indipendenti dalle tabelle applicative.
CREATE TABLE "ImportazioneLegacy" (
  "id" TEXT NOT NULL, "origine" TEXT NOT NULL, "autoreId" TEXT NOT NULL,
  "stato" TEXT NOT NULL DEFAULT 'ANTEPRIMA', "piano" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportazioneLegacy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ImportazioneLegacy_origine_createdAt_idx" ON "ImportazioneLegacy"("origine", "createdAt");
CREATE TABLE "ImportazioneLegacyRiga" (
  "id" TEXT NOT NULL, "origine" TEXT NOT NULL, "chiave" TEXT NOT NULL,
  "dati" JSONB NOT NULL, "rigaAttivitaId" TEXT, "impronta" TEXT,
  "ignorata" BOOLEAN NOT NULL DEFAULT false, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportazioneLegacyRiga_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ImportazioneLegacyRiga_origine_chiave_key" ON "ImportazioneLegacyRiga"("origine", "chiave");
CREATE INDEX "ImportazioneLegacyRiga_origine_rigaAttivitaId_idx" ON "ImportazioneLegacyRiga"("origine", "rigaAttivitaId");
