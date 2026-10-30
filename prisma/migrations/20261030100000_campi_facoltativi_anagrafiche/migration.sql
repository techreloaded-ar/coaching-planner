-- Anagrafiche con meno campi obbligatori: partita IVA del collaboratore,
-- tariffa giornaliera e giorni previsti dell'offerta diventano facoltativi;
-- la descrizione dell'offerta può restare vuota.
ALTER TABLE "Collaboratore" ALTER COLUMN "partitaIva" DROP NOT NULL;

ALTER TABLE "Offerta" ALTER COLUMN "descrizione" SET DEFAULT '',
ALTER COLUMN "tariffaGiornaliera" DROP NOT NULL,
ALTER COLUMN "giorniPrevisti" DROP NOT NULL;
