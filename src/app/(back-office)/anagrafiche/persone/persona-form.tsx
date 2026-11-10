"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import {
  CampoNote,
  ChipStato,
  PulsanteAttesa,
  useValoriInviati,
} from "@/components";
import { useIdratata } from "@/components/use-idratata";
import { tokenMeseCorrente } from "@/domain/calendario";
import { ETICHETTA_MODALITA_TARIFFA, MODALITA_TARIFFA } from "@/domain/tariffe";
import type { UtenteConProfiloCollaboratore } from "@/lib/utenti";
import {
  aggiornaUtente,
  creaUtente,
  type StatoAction,
} from "../utenti/actions";

const SEZIONI = [
  { id: "anagrafica", etichetta: "Anagrafica" },
  { id: "attivita", etichetta: "Attività e compensi" },
  { id: "accesso", etichetta: "Accesso e permessi" },
] as const;
type Sezione = (typeof SEZIONI)[number]["id"];
const inputClass =
  "w-full rounded-[10px] border border-zinc-200 bg-white px-[13px] py-[10px] text-sm text-testo-principale focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-900 ";
const buttonClass =
  "inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";

export default function PersonaForm({
  utente,
  attivita,
  sezioneIniziale,
  salvato = false,
}: {
  utente?: UtenteConProfiloCollaboratore;
  attivita?: ReactNode;
  sezioneIniziale?: string;
  salvato?: boolean;
}) {
  const idratata = useIdratata();
  const [sezione, setSezione] = useState<Sezione>(
    SEZIONI.find((s) => s.id === sezioneIniziale)?.id ?? "anagrafica",
  );
  const [amministratore, setAmministratore] = useState(
    utente?.ruolo === "AMMINISTRATORE",
  );
  const [collaboratore, setCollaboratore] = useState(
    utente
      ? utente.ruolo === "COLLABORATORE" ||
          (utente.collaboratore !== null &&
            (utente.collaboratore.attivo || !utente.attivo))
      : true,
  );
  const [attivo, setAttivo] = useState(utente?.attivo ?? true);
  const [stato, azione] = useActionState<StatoAction, FormData>(
    async (precedente, dati) => {
      const risultato = await (utente ? aggiornaUtente : creaUtente)(
        precedente,
        dati,
      );
      const campi = Object.keys(risultato.errori);
      if (campi.length) {
        setSezione(
          campi.some((c) =>
            ["nome", "cognome", "email", "partitaIva"].includes(c),
          )
            ? "anagrafica"
            : campi.some((c) =>
                  [
                    "modalitaTariffa",
                    "importoTariffa",
                    "tariffaValidaDalMese",
                  ].includes(c),
                )
              ? "attivita"
              : "accesso",
        );
      }
      return risultato;
    },
    { errori: {} },
  );
  const { azioneConMemoria, valoreIniziale } = useValoriInviati(azione);
  const haProfilo = !!utente?.collaboratore;
  const tariffaIniziale = collaboratore && !haProfilo;

  function cambiaSezione(nuova: Sezione) {
    setSezione(nuova);
    // Il link alla scheda ricorda la sezione, senza rimontare form con modifiche non salvate.
    const url = new URL(window.location.href);
    url.searchParams.set("sezione", nuova);
    window.history.replaceState(null, "", url);
  }

  return (
    <div
      data-idratata={idratata}
      aria-label="Scheda persona"
      className="max-w-[960px]"
    >
      <Link
        href="/anagrafiche/persone"
        className="mb-5 inline-flex gap-2 text-sm font-medium text-testo-secondario hover:text-indigo-600 "
      >
        <span aria-hidden="true">←</span> Tutte le persone
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {utente && (
          <div
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-indigo-500 text-[16px] font-semibold text-white"
          >
            {utente.nome[0]}
            {utente.cognome[0]}
          </div>
        )}
        <div className="min-w-0">
          <div className="mb-1 text-xs font-medium text-testo-metadati ">
            Anagrafiche · Persone
          </div>
          <h1 className="text-[23px] font-semibold tracking-tight text-testo-principale ">
            {utente ? `${utente.nome} ${utente.cognome}` : "Nuova persona"}
          </h1>
          <p className="mt-1 break-words text-sm text-testo-metadati ">
            {utente?.email ??
              "Anagrafica, accessi e collaborazione in un unico posto."}
          </p>
        </div>
        {utente && <ChipStato attivo={utente.attivo} />}
      </div>
      {salvato && (
        <p
          role="status"
          className="mb-5 rounded-[10px] bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
        >
          Modifiche alla persona salvate
        </p>
      )}
      <div
        role="tablist"
        aria-label="Scheda persona"
        className="mb-6 flex flex-wrap gap-x-6 border-b border-zinc-200 dark:border-zinc-800"
      >
        {SEZIONI.map((s, index) => (
          <button
            key={s.id}
            id={`tab-${s.id}`}
            type="button"
            role="tab"
            aria-selected={sezione === s.id}
            aria-controls={`pannello-${s.id}`}
            tabIndex={sezione === s.id ? 0 : -1}
            onClick={() => cambiaSezione(s.id)}
            onKeyDown={(e) => {
              const indice =
                e.key === "ArrowRight"
                  ? (index + 1) % SEZIONI.length
                  : e.key === "ArrowLeft"
                    ? (index + SEZIONI.length - 1) % SEZIONI.length
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? SEZIONI.length - 1
                        : null;
              if (indice !== null) {
                e.preventDefault();
                cambiaSezione(SEZIONI[indice].id);
                document.getElementById(`tab-${SEZIONI[indice].id}`)?.focus();
              }
            }}
            className={`min-h-11 border-b-2 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-500 ${sezione === s.id ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-testo-metadati hover:text-testo-principale  "}`}
          >
            {s.etichetta}
          </button>
        ))}
      </div>
      <form
        noValidate
        action={azioneConMemoria}
        aria-label={utente ? "Modifica persona" : "Nuova persona"}
      >
        {utente && (
          <>
            <input type="hidden" name="id" value={utente.id} />
            <input type="hidden" name="gestisciAccesso" value="true" />
          </>
        )}
        <input type="hidden" name="sezione" value={sezione} />
        {amministratore && (
          <input type="hidden" name="ruoloAmministratore" value="on" />
        )}
        {collaboratore && (
          <input type="hidden" name="ruoloCollaboratore" value="on" />
        )}
        {haProfilo && (
          <input type="hidden" name="aggiornaPartitaIva" value="true" />
        )}
        {Object.keys(stato.errori).length > 0 && (
          <div
            role="alert"
            className="mb-5 rounded-[10px] border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
          >
            {stato.errori._form ??
              "Controlla i campi evidenziati: alcuni dati mancano o non sono validi."}
          </div>
        )}
        <section
          id="pannello-anagrafica"
          role="tabpanel"
          aria-labelledby="tab-anagrafica"
          hidden={sezione !== "anagrafica"}
          className="rounded-[11px] border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 max-[640px]:p-4"
        >
          <h2 className="mb-5 text-[16px] font-semibold text-testo-principale ">
            Dati della persona
          </h2>
          <div className="grid grid-cols-2 gap-x-5 max-[640px]:grid-cols-1">
            <Campo
              label="Nome"
              name="nome"
              autoComplete="given-name"
              defaultValue={valoreIniziale("nome", utente?.nome ?? "")}
              errore={stato.errori.nome}
            />
            <Campo
              label="Cognome"
              name="cognome"
              autoComplete="family-name"
              defaultValue={valoreIniziale("cognome", utente?.cognome ?? "")}
              errore={stato.errori.cognome}
            />
            <div className="col-span-2 max-[640px]:col-span-1">
              <Campo
                label="Email di accesso"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={valoreIniziale("email", utente?.email ?? "")}
                errore={stato.errori.email}
              />
            </div>
            {(collaboratore || haProfilo) && (
              <div className="col-span-2 max-[640px]:col-span-1">
                <Campo
                  label="Partita IVA"
                  name="partitaIva"
                  facoltativo
                  defaultValue={valoreIniziale(
                    "partitaIva",
                    utente?.collaboratore?.partitaIva ?? "",
                  )}
                  errore={stato.errori.partitaIva}
                />
              </div>
            )}
            <CampoNote
              className="col-span-2 max-[640px]:col-span-1"
              defaultValue={valoreIniziale("note", utente?.note ?? "")}
            />
          </div>
        </section>
        {!haProfilo && (
          <section
            id="pannello-attivita"
            role="tabpanel"
            aria-labelledby="tab-attivita"
            hidden={sezione !== "attivita"}
            className="rounded-[11px] border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 max-[640px]:p-4"
          >
            {tariffaIniziale ? (
              <>
                <h2 className="mb-2 text-[16px] font-semibold text-testo-principale ">
                  Tariffa iniziale
                </h2>
                <p className="mb-5 text-sm text-testo-metadati ">
                  Facoltativa. Dopo il salvataggio potrai gestire lo storico
                  tariffe e le offerte abilitate da questa sezione.
                </p>
                <label
                  htmlFor="modalitaTariffa"
                  className="mb-2 block text-sm font-medium text-testo-secondario "
                >
                  Modalità tariffa
                </label>
                <select
                  id="modalitaTariffa"
                  name="modalitaTariffa"
                  defaultValue={valoreIniziale(
                    "modalitaTariffa",
                    "GIORNALIERA",
                  )}
                  aria-invalid={!!stato.errori.modalitaTariffa}
                  aria-describedby={
                    stato.errori.modalitaTariffa
                      ? "errore-modalitaTariffa"
                      : undefined
                  }
                  className={`${inputClass} mb-4`}
                >
                  {MODALITA_TARIFFA.map((m) => (
                    <option key={m} value={m}>
                      {ETICHETTA_MODALITA_TARIFFA[m]}
                    </option>
                  ))}
                </select>
                {stato.errori.modalitaTariffa && (
                  <p
                    id="errore-modalitaTariffa"
                    className="mb-4 text-xs text-red-600 dark:text-red-400"
                  >
                    {stato.errori.modalitaTariffa}
                  </p>
                )}
                <Campo
                  label="Importo tariffa"
                  name="importoTariffa"
                  facoltativo
                  defaultValue={valoreIniziale("importoTariffa", "")}
                  errore={stato.errori.importoTariffa}
                />
                <Campo
                  label="Tariffa valida dal mese"
                  name="tariffaValidaDalMese"
                  type="month"
                  facoltativo
                  defaultValue={valoreIniziale(
                    "tariffaValidaDalMese",
                    tokenMeseCorrente(),
                  )}
                  errore={stato.errori.tariffaValidaDalMese}
                />
              </>
            ) : (
              <>
                <h2 className="mb-2 text-[16px] font-semibold text-testo-principale ">
                  Nessuna attività da consuntivare
                </h2>
                <p className="text-sm text-testo-metadati ">
                  In Accesso e permessi puoi abilitare la registrazione delle
                  attività come collaboratore.
                </p>
              </>
            )}
          </section>
        )}
        <section
          id="pannello-accesso"
          role="tabpanel"
          aria-labelledby="tab-accesso"
          hidden={sezione !== "accesso"}
          className="rounded-[11px] border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 max-[640px]:p-4"
        >
          <fieldset
            aria-describedby={
              stato.errori.ruoli ? "errore-ruoli" : "hint-ruoli"
            }
          >
            <legend className="mb-3 text-[16px] font-medium text-testo-principale ">
              Ruoli
            </legend>
            <p id="hint-ruoli" className="mb-3 text-sm text-testo-metadati">
              Seleziona uno o entrambi i ruoli.
            </p>
            <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
              {(["AMMINISTRATORE", "COLLABORATORE"] as const).map((r) => {
                const selezionato =
                  r === "AMMINISTRATORE" ? amministratore : collaboratore;
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={selezionato}
                    onClick={() => {
                      if (r === "AMMINISTRATORE")
                        setAmministratore(!amministratore);
                      else setCollaboratore(!collaboratore);
                    }}
                    className={`rounded-xl border p-4 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-500 ${selezionato ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" : "border-zinc-200 text-testo-secondario hover:border-indigo-300 dark:border-zinc-700 "}`}
                  >
                    {r === "AMMINISTRATORE"
                      ? "Amministratore"
                      : "Collaboratore"}
                    <span className="mt-1 block text-xs font-normal text-testo-metadati ">
                      {r === "AMMINISTRATORE"
                        ? "Gestisce persone, clienti, offerte e report."
                        : "Registra e consulta le proprie attività."}
                    </span>
                  </button>
                );
              })}
            </div>
            {stato.errori.ruoli && (
              <p
                id="errore-ruoli"
                className="mt-2 text-sm text-red-600 dark:text-red-400"
              >
                {stato.errori.ruoli}
              </p>
            )}
          </fieldset>
          {utente && (
            <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <label className="flex items-center gap-3 text-sm font-medium text-testo-secondario ">
                <input
                  type="checkbox"
                  name="attivo"
                  checked={attivo}
                  onChange={(e) => setAttivo(e.target.checked)}
                  className="h-4 w-4 accent-indigo-500"
                />
                Accesso attivo
              </label>
              <p className="mt-2 text-xs text-testo-metadati ">
                Disattivando l’accesso, i consuntivi e lo storico restano
                disponibili.
              </p>
            </div>
          )}
        </section>
        <div
          hidden={sezione === "attivita" && haProfilo}
          className="mt-5 flex flex-wrap justify-end gap-3"
        >
          <Link
            href="/anagrafiche/persone"
            className={`${buttonClass} border border-zinc-200 bg-white text-testo-secondario dark:border-zinc-700 dark:bg-zinc-900 `}
          >
            Annulla
          </Link>
          <PulsanteAttesa
            etichettaAttesa="Salvataggio…"
            className={`${buttonClass} bg-indigo-500 text-white hover:bg-indigo-600`}
          >
            {utente ? "Salva modifiche" : "Crea persona"}
          </PulsanteAttesa>
        </div>
      </form>
      {haProfilo && (
        <section
          id="pannello-attivita"
          role="tabpanel"
          aria-labelledby="tab-attivita"
          hidden={sezione !== "attivita"}
        >
          {attivita}
        </section>
      )}
    </div>
  );
}

function Campo({
  label,
  name,
  defaultValue,
  type = "text",
  autoComplete,
  errore,
  facoltativo = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  autoComplete?: string;
  errore?: string;
  facoltativo?: boolean;
}) {
  return (
    <div className="mb-[18px] min-w-0">
      <label
        htmlFor={name}
        className="mb-1.5 block text-sm font-medium text-testo-secondario "
      >
        {label}
        {facoltativo ? (
          <span className="ml-1 font-normal text-testo-metadati">
            (facoltativo)
          </span>
        ) : (
          <span className="ml-1 text-red-600">*</span>
        )}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={!!errore}
        aria-describedby={errore ? `errore-${name}` : undefined}
        className={`${inputClass} ${errore ? "border-red-500" : ""}`}
      />
      {errore && (
        <p
          id={`errore-${name}`}
          className="mt-1 text-xs text-red-600 dark:text-red-400"
        >
          {errore}
        </p>
      )}
    </div>
  );
}
