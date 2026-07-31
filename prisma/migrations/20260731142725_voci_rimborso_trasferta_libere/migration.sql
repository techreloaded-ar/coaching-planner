/*
  Warnings:

  - You are about to drop the column `trasfertaKm` on the `RigaAttivita` table. All the data in the column will be lost.
  - You are about to drop the `ScaglioneKm` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "RigaAttivita" DROP COLUMN "trasfertaKm",
ADD COLUMN     "rimborsoTrasfertaEtichetta" TEXT,
ADD COLUMN     "rimborsoTrasfertaImporto" DECIMAL(10,2);

-- DropTable
DROP TABLE "ScaglioneKm";

-- CreateTable
CREATE TABLE "VoceRimborsoTrasferta" (
    "id" TEXT NOT NULL,
    "etichetta" TEXT NOT NULL,
    "importo" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoceRimborsoTrasferta_pkey" PRIMARY KEY ("id")
);
