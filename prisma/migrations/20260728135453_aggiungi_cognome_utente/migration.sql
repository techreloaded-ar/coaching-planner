-- AlterTable
ALTER TABLE "Utente" ADD COLUMN "cognome" TEXT;

-- Backfill dal profilo Collaboratore, quando presente
UPDATE "Utente" u SET "nome" = c."nome", "cognome" = c."cognome" FROM "Collaboratore" c WHERE c."userId" = u."id";

-- Split del nome per gli utenti rimasti senza cognome (es. Amministratore senza profilo Collaboratore)
UPDATE "Utente" SET "cognome" = CASE WHEN position(' ' IN btrim("nome")) > 0 THEN btrim(substr(btrim("nome"), position(' ' IN btrim("nome")) + 1)) ELSE btrim("nome") END, "nome" = split_part(btrim("nome"), ' ', 1) WHERE "cognome" IS NULL;

-- Rende la colonna obbligatoria
ALTER TABLE "Utente" ALTER COLUMN "cognome" SET NOT NULL;
