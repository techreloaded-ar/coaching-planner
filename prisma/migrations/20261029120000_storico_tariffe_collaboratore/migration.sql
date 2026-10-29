-- CreateEnum
CREATE TYPE "ModalitaTariffa" AS ENUM ('GIORNALIERA', 'FISSO_MENSILE');

-- CreateTable
CREATE TABLE "TariffaCollaboratore" (
    "id" TEXT NOT NULL,
    "collaboratoreId" TEXT NOT NULL,
    "validaDalMese" TEXT NOT NULL,
    "modalita" "ModalitaTariffa" NOT NULL,
    "importo" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TariffaCollaboratore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TariffaCollaboratore_collaboratoreId_validaDalMese_key" ON "TariffaCollaboratore"("collaboratoreId", "validaDalMese");

-- AddForeignKey
ALTER TABLE "TariffaCollaboratore" ADD CONSTRAINT "TariffaCollaboratore_collaboratoreId_fkey" FOREIGN KEY ("collaboratoreId") REFERENCES "Collaboratore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrazione dati: la tariffa giornaliera attuale diventa la prima voce dello
-- storico, valida dal mese più vecchio tra la creazione del collaboratore e la
-- sua prima riga attività, così i calcoli dei mesi passati non cambiano.
INSERT INTO "TariffaCollaboratore" ("id", "collaboratoreId", "validaDalMese", "modalita", "importo", "createdAt", "updatedAt")
SELECT
    'migrata-' || c."id",
    c."id",
    to_char(LEAST(c."createdAt"::date, COALESCE(MIN(r."data"), c."createdAt"::date)), 'YYYY-MM'),
    'GIORNALIERA',
    c."tariffaGiornaliera",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Collaboratore" c
LEFT JOIN "RigaAttivita" r ON r."collaboratoreId" = c."id"
GROUP BY c."id", c."createdAt", c."tariffaGiornaliera";

-- AlterTable
ALTER TABLE "Collaboratore" DROP COLUMN "tariffaGiornaliera";
