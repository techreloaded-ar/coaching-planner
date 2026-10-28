-- CreateEnum
CREATE TYPE "GestioneTrasferta" AS ENUM ('INCLUSA', 'FORFETTARIA');

-- AlterTable: le offerte esistenti partono con la trasferta inclusa nella tariffa
ALTER TABLE "Offerta" ADD COLUMN "gestioneTrasferta" "GestioneTrasferta" NOT NULL DEFAULT 'INCLUSA',
ADD COLUMN "importoTrasfertaForfettaria" DECIMAL(10,2);
