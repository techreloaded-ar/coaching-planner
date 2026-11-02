-- Righe del foglio di pianificazione che l'import Excel non ha potuto abbinare
CREATE TYPE "MotivoSospensione" AS ENUM ('COLLABORATORE_SCONOSCIUTO', 'CLIENTE_SCONOSCIUTO', 'OFFERTA_SCONOSCIUTA', 'OFFERTA_ALTRO_CLIENTE', 'DATI_NON_VALIDI');

CREATE TABLE "RigaAttivitaSospesa" (
    "id" TEXT NOT NULL,
    "collaboratore" TEXT,
    "data" TEXT,
    "cliente" TEXT,
    "codiceOfferta" TEXT,
    "ore" TEXT,
    "tipologiaFatturazione" TEXT,
    "motivo" "MotivoSospensione" NOT NULL,
    "nota" TEXT,
    "risoltaIl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RigaAttivitaSospesa_pkey" PRIMARY KEY ("id")
);
