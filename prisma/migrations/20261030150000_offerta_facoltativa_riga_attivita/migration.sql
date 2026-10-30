-- AlterTable: l'offerta di una riga attività diventa facoltativa
ALTER TABLE "RigaAttivita" ALTER COLUMN "offertaId" DROP NOT NULL;
