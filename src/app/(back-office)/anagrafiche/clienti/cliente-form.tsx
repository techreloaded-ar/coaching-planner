"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PulsanteAttesa } from "@/components";
import {
  creaCliente,
  aggiornaCliente,
  type StatoAction,
} from "./actions";

// ── Props ──────────────────────────────────────────────────────

interface ClienteFormProps {
  /** Se presente, il form è in modalità modifica con dati precompilati */
  cliente?: {
    id: string;
    ragioneSociale: string;
    partitaIva: string | null;
    codiceFiscale: string | null;
    indirizzo: string | null;
    citta: string | null;
    cap: string | null;
    provincia: string | null;
    pec: string | null;
    codiceDestinatario: string | null;
    attivo: boolean;
  };
}

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

// ── Componente ─────────────────────────────────────────────────

export default function ClienteForm({ cliente }: ClienteFormProps) {
  const inModifica = !!cliente;

  const [stato, azione] = useActionState(
    inModifica ? aggiornaCliente : creaCliente,
    statoIniziale
  );

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

  // Se il form è inviato con successo, il redirect verrà gestito
  // dalla server action (che chiama redirect()). Qui gestiamo solo
  // l'eventuale navigazione indietro.

  return (
    <div>
      {/* Link indietro */}
      <Link
        href="/anagrafiche/clienti"
        className="mb-[14px] inline-flex items-center gap-[6px] text-[13px] font-semibold text-zinc-600 no-underline transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2.2}>
          <path d="M19 12H5m6 6-6-6 6-6" />
        </svg>
        Torna all&apos;elenco clienti
      </Link>

      {/* Intestazione view */}
      <div className="mb-[22px]">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
          Anagrafiche · Clienti
        </div>
        <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
          {inModifica ? "Modifica cliente" : "Nuovo cliente"}
        </h1>
        <p className="mt-[6px] max-w-[560px] text-[13px] text-zinc-400 dark:text-zinc-500">
          Ragione sociale e dati di fatturazione: i campi obbligatori sono validati prima del salvataggio.
        </p>
      </div>

      {/* Form */}
      <form
        noValidate
        action={azioneConMemoria}
        className="max-w-[760px] rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        {inModifica && <input type="hidden" name="id" value={cliente!.id} />}

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
            {/* ── Dati societari ── */}
            <div className="col-span-2 mt-0 flex items-center gap-[8px] border-b border-zinc-100 pb-3 pt-[6px] text-[11px] font-bold uppercase tracking-[.08em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] text-indigo-500" strokeWidth={2}>
                <path d="M3 21V8.5L9 4l6 4.5V21" /><path d="M15 21h6V11l-6-3" />
              </svg>
              Dati societari
            </div>

            <Campo
              label="Ragione sociale"
              name="ragioneSociale"
              placeholder="Es. Banca Sintesi S.p.A."
              autoComplete="organization"
              defaultValue={valoreIniziale("ragioneSociale", cliente?.ragioneSociale ?? "")}
              errore={stato.errori.ragioneSociale}
              obbligatorio
              fullWidth
            />

            <Campo
              label="Partita IVA"
              name="partitaIva"
              placeholder="11 cifre, es. 04127730961"
              inputMode="numeric"
              maxLength={11}
              defaultValue={valoreIniziale("partitaIva", cliente?.partitaIva ?? "")}
              errore={stato.errori.partitaIva}
              obbligatorio
            />

            <Campo
              label="Codice fiscale"
              name="codiceFiscale"
              placeholder="Se diverso dalla P.IVA"
              maxLength={16}
              defaultValue={valoreIniziale("codiceFiscale", cliente?.codiceFiscale ?? "")}
              errore={stato.errori.codiceFiscale}
              facoltativo
            />

            {/* ── Sede legale ── */}
            <div className="col-span-2 mt-2 flex items-center gap-[8px] border-b border-zinc-100 pb-3 pt-[6px] text-[11px] font-bold uppercase tracking-[.08em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] text-indigo-500" strokeWidth={2}>
                <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" />
              </svg>
              Sede legale
            </div>

            <Campo
              label="Indirizzo"
              name="indirizzo"
              placeholder="Via e numero civico"
              autoComplete="street-address"
              defaultValue={valoreIniziale("indirizzo", cliente?.indirizzo ?? "")}
              errore={stato.errori.indirizzo}
              facoltativo
              fullWidth
            />

            <div className="col-span-2 grid grid-cols-[1fr_130px_90px] gap-[18px]">
              <Campo
                label="Città"
                name="citta"
                placeholder="Es. Milano"
                autoComplete="address-level2"
                defaultValue={valoreIniziale("citta", cliente?.citta ?? "")}
                errore={stato.errori.citta}
                facoltativo
              />
              <Campo
                label="CAP"
                name="cap"
                placeholder="20121"
                inputMode="numeric"
                maxLength={5}
                autoComplete="postal-code"
                defaultValue={valoreIniziale("cap", cliente?.cap ?? "")}
                errore={stato.errori.cap}
                facoltativo
              />
              <Campo
                label="Provincia"
                name="provincia"
                placeholder="MI"
                maxLength={2}
                defaultValue={valoreIniziale("provincia", cliente?.provincia ?? "")}
                errore={stato.errori.provincia}
                facoltativo
                uppercase
              />
            </div>

            {/* ── Fatturazione elettronica ── */}
            <div className="col-span-2 mt-2 flex items-center gap-[8px] border-b border-zinc-100 pb-3 pt-[6px] text-[11px] font-bold uppercase tracking-[.08em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] text-indigo-500" strokeWidth={2}>
                <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M14 3v6h6M8 13h8M8 17h5" />
              </svg>
              Fatturazione elettronica
            </div>

            <Campo
              label="PEC"
              name="pec"
              type="email"
              placeholder="fatture@pec.azienda.it"
              defaultValue={valoreIniziale("pec", cliente?.pec ?? "")}
              errore={stato.errori.pec}
              facoltativo
            />

            <Campo
              label="Codice destinatario SDI"
              name="codiceDestinatario"
              placeholder="7 caratteri, es. M5UXCR1"
              maxLength={7}
              defaultValue={valoreIniziale("codiceDestinatario", cliente?.codiceDestinatario ?? "")}
              errore={stato.errori.codiceDestinatario}
              facoltativo
              uppercase
            />
          </div>
        </div>

        {/* Footer del form */}
        <div className="flex items-center justify-end gap-[10px] rounded-b-[11px] border-t border-zinc-200 bg-zinc-50 px-7 py-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          {inModifica && (
            <span className="mr-auto flex items-center gap-[9px] text-[12.5px] text-zinc-400 dark:text-zinc-500">
              Stato attuale:{" "}
              {cliente!.attivo ? (
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
          )}
          <Link
            href="/anagrafiche/clienti"
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm no-underline transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750"
          >
            Annulla
          </Link>
          <PulsanteAttesa
            etichettaAttesa={inModifica ? "Salvataggio…" : "Creazione…"}
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-indigo-500 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {inModifica ? "Salva modifiche" : "Crea cliente"}
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
  inputMode?: "numeric" | "text" | "email";
  maxLength?: number;
  autoComplete?: string;
  defaultValue?: string;
  errore?: string;
  obbligatorio?: boolean;
  facoltativo?: boolean;
  fullWidth?: boolean;
  uppercase?: boolean;
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
        name={name}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`w-full rounded-[10px] border bg-white px-[13px] py-[10px] font-[inherit] text-[14px] text-zinc-800 outline-none transition placeholder:text-zinc-400 dark:bg-zinc-900 dark:text-zinc-100 ${
          errore
            ? "border-red-600 shadow-[0_0_0_3px_rgb(239_68_68_/_0.08)] dark:shadow-[0_0_0_3px_rgb(239_68_68_/_0.1)]"
            : "border-zinc-200 focus:border-indigo-300 focus:shadow-[0_0_0_3px_rgb(99_102_241_/_0.12)] dark:border-zinc-700 dark:focus:border-indigo-500/50"
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
    </div>
  );
}
