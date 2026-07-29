"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PulsanteAttesa } from "@/components";
import {
  RUOLI_AMMESSI,
} from "@/domain/anagrafiche/valida-utente";
import {
  aggiornaUtente,
  creaUtente,
  type StatoAction,
} from "./actions";

const statoIniziale: StatoAction = { errori: {} };

type RuoloAmmesso = (typeof RUOLI_AMMESSI)[number];

const ETICHETTE_RUOLO: Record<RuoloAmmesso, string> = {
  AMMINISTRATORE: "Amministratore",
  COLLABORATORE: "Collaboratore",
};

const DESCRIZIONI_RUOLO: Record<RuoloAmmesso, string> = {
  AMMINISTRATORE:
    "Accede alla console e governa clienti, offerte e utenti.",
  COLLABORATORE:
    "Accede al front office per registrare le proprie attività.",
};

/** Estrae dal FormData i soli campi testuali, per ripopolare i defaultValue. */
function memorizzaValoriTestuali(datiForm: FormData): Record<string, string> {
  const valoriTestuali: Record<string, string> = {};
  for (const [nomeCampo, valore] of datiForm.entries()) {
    if (typeof valore === "string") valoriTestuali[nomeCampo] = valore;
  }
  return valoriTestuali;
}

interface UtenteFormProps {
  utente?: {
    id: string;
    nome: string;
    cognome: string;
    email: string;
    ruolo: RuoloAmmesso;
    attivo: boolean;
    collaboratore: { attivo: boolean } | null;
  };
}

export default function UtenteForm({ utente }: UtenteFormProps) {
  const inModifica = !!utente;
  const [stato, azione] = useActionState<StatoAction, FormData>(
    inModifica ? aggiornaUtente : creaUtente,
    statoIniziale
  );
  const haErrori = Object.keys(stato.errori).length > 0;
  // Default dei due checkbox ruolo, condivisi da creazione e modifica.
  // In creazione: Amministratore deselezionato, Collaboratore selezionato.
  // In modifica: derivati da ruolo e profilo collaboratore.
  const amministratoreDefault = inModifica
    ? utente.ruolo === "AMMINISTRATORE"
    : false;
  const collaboratoreDefault = inModifica
    ? utente.collaboratore
      ? utente.collaboratore.attivo
      : utente.ruolo === "COLLABORATORE"
    : true;
  // Checkbox controllati (non defaultChecked/uncontrolled): dopo un submit
  // fallito React 19 resetta i campi non controllati del form allo stato
  // iniziale del DOM, ma non lo stato React — con un checkbox uncontrolled
  // la sezione profilo (pilotata dallo stato) resterebbe visibile mentre il
  // checkbox torna deselezionato, disallineando silenziosamente il valore
  // inviato al server dai dati che l'utente vede compilati a schermo.
  const [amministratoreSelezionato, setAmministratoreSelezionato] =
    useState(amministratoreDefault);
  const [collaboratoreSelezionato, setCollaboratoreSelezionato] =
    useState(collaboratoreDefault);
  // I campi di testo restano non controllati: solo così quanto digitato prima
  // dell'idratazione sopravvive. Per non perdere i dati quando la validazione
  // fallisce memorizziamo i valori dell'ultimo invio e li rimettiamo come
  // defaultValue, che React 19 riapplica quando ripristina il form.
  const [valoriInviati, setValoriInviati] = useState<Record<string, string> | null>(
    null
  );

  function azioneConMemoria(datiForm: FormData) {
    setValoriInviati(memorizzaValoriTestuali(datiForm));
    return azione(datiForm);
  }

  function valoreIniziale(nomeCampo: string, valoreOriginale: string) {
    return valoriInviati?.[nomeCampo] ?? valoreOriginale;
  }
  // La sezione "Profilo collaboratore" serve solo quando il collaboratore è
  // selezionato e non esiste ancora un profilo: in modifica con profilo (attivo
  // o disattivato) non deve mai comparire.
  const mostraProfiloCollaboratore =
    collaboratoreSelezionato && (!inModifica || utente.collaboratore === null);

  return (
    <div>
      <Link
        href="/anagrafiche/utenti"
        className="mb-[14px] inline-flex items-center gap-[6px] text-[13px] font-semibold text-zinc-600 no-underline transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="h-[15px] w-[15px]"
          strokeWidth={2.2}
          aria-hidden="true"
        >
          <path d="M19 12H5m6 6-6-6 6-6" />
        </svg>
        Torna all&apos;elenco utenti
      </Link>

      <div className="mb-[22px]">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
          Amministrazione · Utenti
        </div>
        <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
          {inModifica ? "Modifica utente" : "Nuovo utente"}
        </h1>
        <p className="mt-[6px] max-w-[580px] text-[13px] leading-[1.55] text-zinc-400 dark:text-zinc-500">
          {inModifica
            ? "Aggiorna nome, email e ruoli dell'utente: Amministratore e Collaboratore sono combinabili. Il nuovo assetto ha effetto al primo accesso protetto successivo."
            : "Indica nome, email e ruolo. L'utente comparirà in elenco con stato attivo e la sua email sarà riconosciuta dal flusso di accesso."}
        </p>
      </div>

      <form
        noValidate
        action={azioneConMemoria}
        className="max-w-[720px] overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        {inModifica && <input type="hidden" name="id" value={utente.id} />}

        <div className="px-7 pb-2 pt-[26px]">
          {haErrori && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-[9px] rounded-[11px] border border-red-200 bg-red-50 px-[13px] py-[11px] text-[13px] font-semibold leading-[1.45] text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="mt-[1.5px] h-4 w-4 shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path d="M12 9v4.5M12 17h.01" />
                <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              <span>
                {stato.errori._form ??
                  "Controlla i campi evidenziati: alcuni dati obbligatori mancano o non sono validi."}
              </span>
            </div>
          )}

          {inModifica && utente.collaboratore && (
            <div className="mb-5 flex items-start gap-[11px] rounded-[11px] border border-amber-200 bg-amber-50 p-[13px] text-[13px] leading-[1.5] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="mt-0.5 h-4 w-4 shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 7.6h.01" />
              </svg>
              <span>
                Questo utente ha un profilo collaboratore. Il profilo operativo
                (partita IVA, tariffa e attivazione) si gestisce
                dall&apos;anagrafica collaboratori.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-5 gap-y-0 max-[640px]:grid-cols-1">
            <SezioneForm icona="anagrafica">Anagrafica</SezioneForm>
            <Campo
              label="Nome"
              name="nome"
              placeholder="Es. Laura"
              autoComplete="name"
              defaultValue={valoreIniziale("nome", utente?.nome ?? "")}
              errore={stato.errori.nome}
              hint="Solo il nome di battesimo: il cognome ha il suo campo dedicato."
            />
            <Campo
              label="Cognome"
              name="cognome"
              placeholder="Es. Bianchi"
              autoComplete="family-name"
              defaultValue={valoreIniziale("cognome", utente?.cognome ?? "")}
              errore={stato.errori.cognome}
            />

            <SezioneForm icona="accesso">Accesso</SezioneForm>
            <Campo
              label="Email di accesso"
              name="email"
              type="email"
              placeholder="nome.cognome@coachingpartners.it"
              autoComplete="email"
              defaultValue={valoreIniziale("email", utente?.email ?? "")}
              errore={stato.errori.email}
              hint="È la credenziale con cui l'utente viene riconosciuto dal flusso di accesso."
            />

            <SezioneForm icona="ruolo">Ruolo</SezioneForm>
            <fieldset
              role="group"
              aria-describedby={stato.errori.ruoli ? "errore-ruoli" : undefined}
              className="col-span-2 mb-[18px] min-w-0 max-[640px]:col-span-1"
            >
                <legend className="mb-1.5 text-[12.5px] font-semibold tracking-[.01em] text-zinc-600 dark:text-zinc-400">
                  Ruolo <span className="font-bold text-red-600 dark:text-red-400">*</span>
                </legend>
                <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
                  {RUOLI_AMMESSI.map((ruolo) => {
                    const etichettaId = `ruolo-${ruolo.toLowerCase()}-etichetta`;
                    const descrizioneId = `ruolo-${ruolo.toLowerCase()}-descrizione`;
                    const eCollaboratore = ruolo === "COLLABORATORE";
                    const nomeCampo = eCollaboratore
                      ? "ruoloCollaboratore"
                      : "ruoloAmministratore";

                    return (
                      <label key={ruolo} className="relative cursor-pointer">
                        <input
                          type="checkbox"
                          name={nomeCampo}
                          checked={
                            eCollaboratore
                              ? collaboratoreSelezionato
                              : amministratoreSelezionato
                          }
                          onChange={(evento) =>
                            eCollaboratore
                              ? setCollaboratoreSelezionato(
                                  evento.target.checked,
                                )
                              : setAmministratoreSelezionato(
                                  evento.target.checked,
                                )
                          }
                          aria-labelledby={etichettaId}
                          aria-describedby={descrizioneId}
                          className="peer sr-only"
                        />
                        <span
                          className={`flex min-h-[72px] items-start gap-[11px] rounded-xl border-[1.5px] bg-white px-[15px] py-3.5 pr-10 transition hover:border-indigo-200 peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:shadow-[0_0_0_3px_rgb(99_102_241_/_0.1)] peer-checked:[&_.ruolo-check]:opacity-100 peer-checked:[&_.ruolo-icona]:border-indigo-500 peer-checked:[&_.ruolo-icona]:bg-indigo-500 peer-checked:[&_.ruolo-icona]:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 dark:bg-zinc-900 dark:hover:border-indigo-500/40 dark:peer-checked:border-indigo-500 dark:peer-checked:bg-indigo-500/10 dark:peer-checked:[&_.ruolo-icona]:border-indigo-500 dark:peer-checked:[&_.ruolo-icona]:bg-indigo-500 dark:peer-checked:[&_.ruolo-icona]:text-white dark:peer-focus-visible:ring-offset-zinc-900 ${
                            stato.errori.ruoli
                              ? "border-red-600"
                              : "border-zinc-200 dark:border-zinc-700"
                          }`}
                        >
                          <span className="ruolo-icona grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                            <IconaRuolo ruolo={ruolo} usaColoreCorrente />
                          </span>
                          <span className="min-w-0 leading-[1.3]">
                            <span
                              id={etichettaId}
                              className="block text-[13.5px] font-bold text-zinc-800 dark:text-zinc-100"
                            >
                              {ETICHETTE_RUOLO[ruolo]}
                            </span>
                            <span
                              id={descrizioneId}
                              className="mt-0.5 block text-[12px] text-zinc-400 dark:text-zinc-500"
                            >
                              {DESCRIZIONI_RUOLO[ruolo]}
                            </span>
                          </span>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            className="ruolo-check absolute right-[13px] top-3 h-4 w-4 text-indigo-600 opacity-0 transition-opacity dark:text-indigo-400"
                            strokeWidth={2.4}
                            aria-hidden="true"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {stato.errori.ruoli && (
                  <div className="mt-1.5">
                    <ErroreCampo id="errore-ruoli">{stato.errori.ruoli}</ErroreCampo>
                  </div>
                )}
            </fieldset>

            {mostraProfiloCollaboratore && (
              <>
                <SezioneForm icona="anagrafica">
                  Profilo collaboratore
                </SezioneForm>
                <Campo
                  label="Partita IVA"
                  name="partitaIva"
                  placeholder="11 cifre, es. 03481920457"
                  defaultValue={valoreIniziale("partitaIva", "")}
                  errore={stato.errori.partitaIva}
                  hint="Undici cifre numeriche, senza spazi né prefissi."
                />
                <Campo
                  label="Tariffa giornaliera"
                  name="tariffaGiornaliera"
                  placeholder="Es. 520,00"
                  defaultValue={valoreIniziale("tariffaGiornaliera", "")}
                  errore={stato.errori.tariffaGiornaliera}
                  hint="Importo in euro, virgola per i decimali (massimo 2)."
                />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-[10px] border-t border-zinc-200 bg-zinc-50 px-7 py-4 dark:border-zinc-700 dark:bg-zinc-800/50 max-[520px]:flex-wrap">
          {inModifica && (
            <span className="mr-auto flex items-center gap-2 text-[12.5px] text-zinc-400 dark:text-zinc-500 max-[520px]:w-full">
              Stato attuale:
              <span
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[11.5px] font-semibold ${
                  utente.attivo
                    ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                    : "border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {utente.attivo ? "Attivo" : "Invalidato"}
              </span>
            </span>
          )}
          <Link
            href="/anagrafiche/utenti"
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm no-underline transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Annulla
          </Link>
          <PulsanteAttesa
            etichettaAttesa={inModifica ? "Salvataggio…" : "Censimento…"}
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-indigo-500 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-600"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="h-4 w-4"
              strokeWidth={2}
              aria-hidden="true"
            >
              {inModifica ? (
                <path d="M20 6 9 17l-5-5" />
              ) : (
                <path d="M12 5v14M5 12h14" />
              )}
            </svg>
            {inModifica ? "Salva modifiche" : "Censisci utente"}
          </PulsanteAttesa>
        </div>
      </form>
    </div>
  );
}

interface CampoProps {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  defaultValue: string;
  errore?: string;
  hint?: string;
}

function Campo({
  label,
  name,
  placeholder,
  type = "text",
  autoComplete,
  defaultValue,
  errore,
  hint,
}: CampoProps) {
  const erroreId = `errore-${name}`;
  const hintId = `hint-${name}`;

  return (
    <div className="col-span-2 mb-[18px] flex min-w-0 flex-col gap-1.5 max-[640px]:col-span-1">
      <label
        htmlFor={name}
        className="text-[12.5px] font-semibold tracking-[.01em] text-zinc-600 dark:text-zinc-400"
      >
        {label} <span className="font-bold text-red-600 dark:text-red-400">*</span>
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={!!errore}
        aria-describedby={errore ? erroreId : hint ? hintId : undefined}
        className={`w-full rounded-[10px] border bg-white px-[13px] py-[10px] font-[inherit] text-[14px] text-zinc-800 outline-none transition placeholder:text-zinc-400 dark:bg-zinc-900 dark:text-zinc-100 ${
          errore
            ? "border-red-600 shadow-[0_0_0_3px_rgb(239_68_68_/_0.08)]"
            : "border-zinc-200 focus:border-indigo-300 focus:shadow-[0_0_0_3px_rgb(99_102_241_/_0.12)] dark:border-zinc-700 dark:focus:border-indigo-500/50"
        }`}
      />
      {errore ? (
        <ErroreCampo id={erroreId}>{errore}</ErroreCampo>
      ) : (
        hint && (
          <p id={hintId} className="m-0 text-[12px] text-zinc-400 dark:text-zinc-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function ErroreCampo({ id, children }: { id: string; children: string }) {
  return (
    <p
      id={id}
      className="m-0 inline-flex items-center gap-[5px] text-[12px] font-semibold text-red-600 dark:text-red-400"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="h-[13px] w-[13px] shrink-0"
        strokeWidth={2.2}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      {children}
    </p>
  );
}

function SezioneForm({
  icona,
  children,
}: {
  icona: "anagrafica" | "accesso" | "ruolo";
  children: string;
}) {
  return (
    <div className="col-span-2 mt-2 flex items-center gap-2 border-b border-zinc-100 pb-3 pt-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-zinc-400 first:mt-0 dark:border-zinc-800 dark:text-zinc-500 max-[640px]:col-span-1">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="h-[14px] w-[14px] text-indigo-500"
        strokeWidth={2}
        aria-hidden="true"
      >
        {icona === "anagrafica" ? (
          <>
            <circle cx="12" cy="8" r="3.6" />
            <path d="M5 20a7 7 0 0 1 14 0" />
          </>
        ) : icona === "accesso" ? (
          <>
            <rect x="4" y="10.5" width="16" height="10" rx="2" />
            <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
          </>
        ) : (
          <path d="M12 3l7 2.5v5.2c0 4.3-2.9 7.4-7 8.8-4.1-1.4-7-4.5-7-8.8V5.5L12 3Z" />
        )}
      </svg>
      {children}
    </div>
  );
}

function IconaRuolo({
  ruolo,
  usaColoreCorrente = false,
}: {
  ruolo: RuoloAmmesso;
  usaColoreCorrente?: boolean;
}) {
  return ruolo === "AMMINISTRATORE" ? (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={`h-4 w-4 ${usaColoreCorrente ? "text-current" : "text-indigo-600 dark:text-indigo-400"}`}
      strokeWidth={2.2}
      aria-hidden="true"
    >
      <path d="M12 3l7 2.5v5.2c0 4.3-2.9 7.4-7 8.8-4.1-1.4-7-4.5-7-8.8V5.5L12 3Z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={`h-4 w-4 ${usaColoreCorrente ? "text-current" : "text-zinc-500 dark:text-zinc-400"}`}
      strokeWidth={2.2}
      aria-hidden="true"
    >
      <circle cx="12" cy="8.5" r="3.3" />
      <path d="M6 19a6 6 0 0 1 12 0" />
    </svg>
  );
}
