-- Persona di riferimento del cliente; numero d'ordine e account Agile Reloaded dell'offerta
ALTER TABLE "Cliente" ADD COLUMN "personaRiferimento" TEXT;
ALTER TABLE "Offerta" ADD COLUMN "numeroOrdine" TEXT;
ALTER TABLE "Offerta" ADD COLUMN "accountAgileReloaded" TEXT;
