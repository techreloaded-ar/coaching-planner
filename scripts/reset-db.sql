-- PostgreSQL: eseguire l'intero file come un unico script, dopo un backup.
-- Cancella tutti i dati applicativi e tutti gli altri utenti.
-- Conserva l'utente stefano.leli@agilereloaded.it, i suoi Account e le sue Session.
-- Se manca, crea Stefano Leli come amministratore attivo.
-- Ripristina le cinque voci di rimborso indicate, non i dati demo del seed.
-- Elimina anche l'eventuale suo profilo Collaboratore e i relativi dati.
-- Non modifica struttura, enum o storico Prisma (_prisma_migrations).
-- Sospendere importazioni, cron e utilizzo dell'app durante il reset.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Impedisce modifiche concorrenti durante controllo e cancellazione.
LOCK TABLE
  public."Utente", public."Account", public."Session",
  public."VerificationToken", public."Collaboratore",
  public."TariffaCollaboratore", public."Cliente", public."Offerta",
  public."VoceRimborsoTrasferta", public."RigaAttivita",
  public."RigaAttivitaSospesa", public."AbilitazioneOfferta",
  public."CollegamentoCalendarioGoogle", public."EventoCalendarioGestito",
  public."PromemoriaFineMeseInviato", public."ImportazioneLegacy",
  public."ImportazioneLegacyRiga"
IN ACCESS EXCLUSIVE MODE;

DO $reset$
DECLARE
  email_da_conservare CONSTANT text := 'stefano.leli@agilereloaded.it';
  id_da_conservare text;
  corrispondenze bigint;
BEGIN
  SELECT count(*) INTO corrispondenze
  FROM public."Utente"
  WHERE lower(email) = lower(email_da_conservare);

  IF corrispondenze > 1 THEN
    RAISE EXCEPTION 'Reset annullato: più utenti corrispondono a %, trovati %.',
      email_da_conservare, corrispondenze;
  END IF;

  IF corrispondenze = 0 THEN
    INSERT INTO public."Utente"
      (id, nome, cognome, email, ruolo, attivo, "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid()::text, 'Stefano', 'Leli', email_da_conservare,
       'AMMINISTRATORE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id INTO id_da_conservare;
  ELSE
    -- Conserva l'identità e gli accessi esistenti, garantendo ruolo e stato.
    UPDATE public."Utente"
    SET nome = 'Stefano', cognome = 'Leli', email = email_da_conservare,
        ruolo = 'AMMINISTRATORE', attivo = true, "updatedAt" = CURRENT_TIMESTAMP
    WHERE lower(email) = lower(email_da_conservare)
    RETURNING id INTO id_da_conservare;
  END IF;

  -- Nessun CASCADE: una relazione inattesa deve bloccare il reset.
  TRUNCATE TABLE
    public."ImportazioneLegacyRiga",
    public."ImportazioneLegacy",
    public."RigaAttivitaSospesa",
    public."RigaAttivita",
    public."AbilitazioneOfferta",
    public."EventoCalendarioGestito",
    public."PromemoriaFineMeseInviato",
    public."CollegamentoCalendarioGoogle",
    public."TariffaCollaboratore",
    public."Collaboratore",
    public."Offerta",
    public."Cliente",
    public."VoceRimborsoTrasferta",
    public."VerificationToken";

  DELETE FROM public."Session" WHERE "userId" <> id_da_conservare;
  DELETE FROM public."Account" WHERE "userId" <> id_da_conservare;
  DELETE FROM public."Utente" WHERE id <> id_da_conservare;

  -- Etichette e importi concordati. UUID e updatedAt vanno esplicitati:
  -- i default Prisma di questi campi non sono default SQL.
  INSERT INTO public."VoceRimborsoTrasferta"
    (id, etichetta, importo, "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid()::text, 'Fino a 100Km', 75.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Fino a 200Km', 170.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Fino a 400Km', 200.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Oltre 400Km', 250.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'EVENTI', 100.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

  IF (SELECT count(*) FROM public."Utente") <> 1 THEN
    RAISE EXCEPTION 'Reset annullato: verifica finale utenti fallita.';
  END IF;

  RAISE NOTICE 'Reset completato: amministratore %, ripristinate cinque voci di rimborso.',
    email_da_conservare;
END;
$reset$;

-- Riepilogo dell'identità conservata, senza token o credenziali.
SELECT id, email, ruolo, attivo
FROM public."Utente";

SELECT etichetta, importo FROM public."VoceRimborsoTrasferta" ORDER BY importo;

COMMIT;

-- In caso di errore, eseguire ROLLBACK prima di qualsiasi altra operazione.
