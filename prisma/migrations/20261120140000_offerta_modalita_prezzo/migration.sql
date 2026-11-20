-- CreateEnum
CREATE TYPE "ModalitaPrezzoOfferta" AS ENUM ('A_GIORNATA', 'A_CORPO');

-- AlterTable: le offerte esistenti restano a giornata
ALTER TABLE "Offerta" ADD COLUMN "modalitaPrezzo" "ModalitaPrezzoOfferta" NOT NULL DEFAULT 'A_GIORNATA',
ADD COLUMN "importoACorpo" DECIMAL(12,2);
