"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PulsanteAttesa } from "@/components";
import { aggiornaCollaboratore, type StatoAction } from "./actions";

// ── Stato iniziale per useActionState ──────────────────────────

const statoIniziale: StatoAction = { errori: {} };

// ── Memoria dei valori inviati ─────────────────────────────────

/** Estrae dal FormData i soli campi testuali, per ripopolare i defaultValue. */
function memorizzaValoriTestuali(datiForm: FormData): Record<string, string> {
  const valoriTestuali: Record<string, string> = {};
  for (const [nomeCampo, valore] of datiForm.entries()) {
    if (typeof valore === "string") valoriTestuali[nomeCampo] = valore;
  }
  return valoriTestuali;
}

// ── Props ──────────────────────────────────────────────────────

interface CollaboratoreFormProps {
  collaboratore: {
    id: string;
    nome: string;
    cognome: string;
    partitaIva: string;
    tariffaGiornaliera: { toString(): string } | string | number;
    attivo: boolean;
    utente: { email: string };
  };
}

// ── Componente ─────────────────────────────────────────────────

export default function CollaboratoreForm({ collaboratore }: CollaboratoreFormProps) {
  const [stato, azione] = useActionState<StatoAction, FormData>(
    aggiornaCollaboratore,
    statoIniziale
  );

  const tariffaIniziale = new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(collaboratore.tariffaGiornaliera));

  // I campi restano non controllati: solo così quanto digitato prima
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

  return (
    <div>
      {/* Link indietro */}
      <Link
        href="/anagrafiche/collaboratori"
        className="mb-[14px] inline-flex items-center gap-[6px] text-[13px] font-semibold text-zinc-600 no-underline transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2.2}>
          <path d="M19 12H5m6 6-6-6 6-6" />
        </svg>
        Torna all&apos;elenco collaboratori
      </Link>

      {/* Intestazione view */}
      <div className="mb-[22px]">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
          Anagrafiche · Collaboratori
        </div>
        <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
          Modifica collaboratore
        </h1>
        <p className="mt-[6px] max-w-[560px] text-[13px] text-zinc-400 dark:text-zinc-500">
          Dati anagrafici, partita IVA e tariffa giornaliera; l&apos;email è la credenziale con cui il
          collaboratore accede al front office.
        </p>
      </div>

      {/* Form */}
      <form
        noValidate
        action={azioneConMemoria}
        className="max-w-[760px] rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input type="hidden" name="id" value={collaboratore.id} />

        <div className="px-7 pb-[10px] pt-[26px]">
          {/* Alert errori generali */}
          {Object.keys(stato.errori).length > 0 && (
            <div className="mb-[18px] flex items-start gap-[9px] rounded-[11px] border border-red-200 bg-red-50 px-[13px] py-[11px] text-[13px] font-semibold leading-[1.45] text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-[1.5px] h-[16px] w-[16px] shrink-0" strokeWidth={2}>
                <path d="M12 9v4.5M12 17h.01" />
                <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              <span>Controlla i campi evidenziati: alcuni dati obbligatori mancano o non sono validi.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-[18px] gap-y-0">
            {/* ── Dati anagrafici ── */}
            <div className="col-span-2 mt-0 flex items-center gap-[8px] border-b border-zinc-100 pb-3 pt-[6px] text-[11px] font-bold uppercase tracking-[.08em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] text-indigo-500" strokeWidth={2}>
                <circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" />
              </svg>
              Dati anagrafici
            </div>

            <Campo
              label="Nome"
              name="nome"
              placeholder="Es. Giulia"
              autoComplete="given-name"
              defaultValue={valoreIniziale("nome", collaboratore.nome)}
              errore={stato.errori.nome}
              obbligatorio
            />

            <Campo
              label="Cognome"
              name="cognome"
              placeholder="Es. Mantovani"
              autoComplete="family-name"
              defaultValue={valoreIniziale("cognome", collaboratore.cognome)}
              errore={stato.errori.cognome}
              obbligatorio
            />

            {/* ── Credenziali di accesso ── */}
            <div className="col-span-2 mt-2 flex items-center gap-[8px] border-b border-zinc-100 pb-3 pt-[6px] text-[11px] font-bold uppercase tracking-[.08em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] text-indigo-500" strokeWidth={2}>
                <circle cx="8" cy="14" r="4.2" /><path d="M11 11 20 2M16.5 5.5 19 8M14 8l2 2" />
              </svg>
              Credenziali di accesso
            </div>

            <Campo
              label="Email di accesso"
              name="email"
              type="email"
              defaultValue={valoreIniziale("email", collaboratore.utente.email)}
              errore={stato.errori.email}
              fullWidth
              soloLettura
              hint="L'email di accesso si modifica dalla schermata Utenti"
            />

            <div className="col-span-2 mb-[18px] flex items-start gap-[11px] rounded-[11px] border border-indigo-200 bg-indigo-50 p-[13px] text-[13px] text-zinc-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-zinc-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-[2px] h-[16px] w-[16px] shrink-0 text-indigo-600 dark:text-indigo-400" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.6h.01" />
              </svg>
              <span>
                <b className="text-indigo-600 dark:text-indigo-400">Accesso con Google, nessuna password da impostare</b> —
                il collaboratore accede al front office con il proprio account Google
                corrispondente a questa email, con ruolo <b>collaboratore</b>.
              </span>
            </div>

            {/* ── Dati fiscali e tariffa ── */}
            <div className="col-span-2 mt-2 flex items-center gap-[8px] border-b border-zinc-100 pb-3 pt-[6px] text-[11px] font-bold uppercase tracking-[.08em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] text-indigo-500" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" /><path d="M14.8 8.6a3.4 3.4 0 0 0-5.6 2.6 3.4 3.4 0 0 0 5.6 2.6M7.6 10.4h4.6M7.6 13h4.6" />
              </svg>
              Dati fiscali e tariffa
            </div>

            <Campo
              label="Partita IVA"
              name="partitaIva"
              placeholder="11 cifre, es. 03481920457"
              inputMode="numeric"
              maxLength={11}
              defaultValue={valoreIniziale("partitaIva", collaboratore.partitaIva)}
              errore={stato.errori.partitaIva}
              obbligatorio
            />

            <Campo
              label="Tariffa giornaliera"
              name="tariffaGiornaliera"
              placeholder="Es. 520,00"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={valoreIniziale("tariffaGiornaliera", tariffaIniziale)}
              errore={stato.errori.tariffaGiornaliera}
              hint="Importo in euro, virgola per i decimali: valorizza i consuntivi del collaboratore"
              obbligatorio
            />
          </div>
        </div>

        {/* Footer del form */}
        <div className="flex items-center justify-end gap-[10px] rounded-b-[11px] border-t border-zinc-200 bg-zinc-50 px-7 py-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <span className="mr-auto flex items-center gap-[9px] text-[12.5px] text-zinc-400 dark:text-zinc-500">
            Stato attuale:{" "}
            {collaboratore.attivo ? (
              <span className="inline-flex items-center gap-[5px] rounded-full bg-emerald-50 px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <span className="h-[6px] w-[6px] rounded-full bg-current" />
                Attivo
              </span>
            ) : (
              <span className="inline-flex items-center gap-[5px] rounded-full border border-zinc-200 bg-zinc-100 px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                <span className="h-[6px] w-[6px] rounded-full bg-current" />
                Disattivato
              </span>
            )}
          </span>
          <Link
            href="/anagrafiche/collaboratori"
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm no-underline transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750"
          >
            Annulla
          </Link>
          <PulsanteAttesa
            etichettaAttesa="Salvataggio…"
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-indigo-500 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Salva modifiche
          </PulsanteAttesa>
        </div>
      </form>
    </div>
  );
}

// ── Campo form con validazione inline ──────────────────────────

interface CampoProps {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  inputMode?: "numeric" | "text" | "email" | "decimal";
  maxLength?: number;
  autoComplete?: string;
  defaultValue?: string;
  errore?: string;
  obbligatorio?: boolean;
  facoltativo?: boolean;
  fullWidth?: boolean;
  uppercase?: boolean;
  hint?: string;
  /** Campo in sola lettura: non modificabile e non inviato nel FormData */
  soloLettura?: boolean;
}

function Campo({
  label,
  name,
  placeholder,
  type = "text",
  inputMode,
  maxLength,
  autoComplete,
  defaultValue,
  errore,
  obbligatorio,
  facoltativo,
  fullWidth,
  uppercase,
  hint,
  soloLettura,
}: CampoProps) {
  return (
    <div
      className={`mb-[18px] flex min-w-0 flex-col gap-[6px] text-left ${fullWidth ? "col-span-2" : ""}`}
      data-campo={name}
    >
      <label htmlFor={name} className="text-[12.5px] font-semibold tracking-[.01em] text-zinc-600 dark:text-zinc-400">
        {label}{" "}
        {obbligatorio && <span className="font-bold text-red-600 dark:text-red-400">*</span>}
        {facoltativo && (
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">(facoltativo)</span>
        )}
      </label>
      <input
        id={name}
        name={soloLettura ? undefined : name}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
        readOnly={soloLettura}
        className={`w-full rounded-[10px] border px-[13px] py-[10px] font-[inherit] text-[14px] outline-none transition placeholder:text-zinc-400 ${
          soloLettura
            ? "cursor-default border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400"
            : `bg-white text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 ${
                errore
                  ? "border-red-600 shadow-[0_0_0_3px_rgb(239_68_68_/_0.08)] dark:shadow-[0_0_0_3px_rgb(239_68_68_/_0.1)]"
                  : "border-zinc-200 focus:border-indigo-300 focus:shadow-[0_0_0_3px_rgb(99_102_241_/_0.12)] dark:border-zinc-700 dark:focus:border-indigo-500/50"
              }`
        }`}
        style={uppercase ? { textTransform: "uppercase" } : undefined}
      />
      {errore && (
        <p className="inline-flex items-center gap-[5px] m-0 text-[12px] font-semibold text-red-600 dark:text-red-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[13px] w-[13px] shrink-0" strokeWidth={2.2}>
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
          </svg>
          {errore}
        </p>
      )}
      {!errore && hint && (
        <p className="m-0 text-[12px] text-zinc-400 dark:text-zinc-500">{hint}</p>
      )}
    </div>
  );
}
