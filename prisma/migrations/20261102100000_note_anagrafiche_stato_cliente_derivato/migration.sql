-- Note libere su clienti, offerte e utenti
ALTER TABLE "Cliente" ADD COLUMN "note" TEXT;
ALTER TABLE "Offerta" ADD COLUMN "note" TEXT;
ALTER TABLE "Utente" ADD COLUMN "note" TEXT;

-- Lo stato del cliente è derivato dalle sue offerte: il flag manuale sparisce
ALTER TABLE "Cliente" DROP COLUMN "attivo";
