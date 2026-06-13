"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  creaOfferta,
  aggiornaOfferta,
  type StatoActionOfferta,
} from "./actions";

interface OffertaFormProps {
  cliente: {
    id: string;
    ragioneSociale: string;
    attivo: boolean;
  };
  offerta?: {
    id: string;
    codice: string;
    descrizione: string;
    tariffaGiornaliera: string;
    giorniPrevisti: number;
  };
}

const statoIniziale: StatoActionOfferta = { errori: {} };

export default function OffertaForm({ cliente, offerta }: OffertaFormProps) {
  const inModifica = !!offerta;
  const [stato, azione] = useActionState(
    inModifica ? aggiornaOfferta : creaOfferta,
    statoIniziale
  );

  const linkCliente = `/anagrafiche/clienti/${cliente.id}`;
  const haErrori = Object.keys(stato.errori).length > 0;

  return (
    <div>
      <Link
        href={linkCliente}
        className="mb-[14px] inline-flex items-center gap-[6px] text-[13px] font-semibold text-zinc-600 no-underline transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2.2}>
          <path d="M19 12H5m6 6-6-6 6-6" />
        </svg>
        Torna al cliente
      </Link>

      <div className="mb-[22px]">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
          Anagrafiche · Clienti · Offerte
        </div>
        <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
          {cliente.ragioneSociale} — {inModifica ? "Modifica offerta" : "Nuova offerta"}
        </h1>
        <div className="mt-[10px] inline-flex items-center gap-[9px] rounded-full border border-indigo-200 bg-indigo-50 px-[13px] py-[5px] text-[12.5px] font-semibold text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400">
          <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-indigo-500 text-[9.5px] font-bold text-white">
            {cliente.ragioneSociale
              .split(/\s+/)
              .map((parte) => parte[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </span>
          {cliente.ragioneSociale}
        </div>
      </div>

      <form
        noValidate
        action={azione}
        className="max-w-[760px] rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input type="hidden" name="clienteId" value={cliente.id} />
        {inModifica && <input type="hidden" name="id" value={offerta.id} />}

        <div className="px-7 pb-[10px] pt-[26px]">
          {haErrori && (
            <div className="mb-[18px] flex items-start gap-[9px] rounded-[11px] border border-red-200 bg-red-50 px-[13px] py-[11px] text-[13px] font-semibold leading-[1.45] text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-[1.5px] h-[16px] w-[16px] shrink-0" strokeWidth={2}>
                <path d="M12 9v4.5M12 17h.01" />
                <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              <span>
                {stato.errori._form ??
                  "Controlla i campi evidenziati: alcuni dati mancano o non sono validi."}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-[18px] gap-y-0 max-[920px]:grid-cols-1">
            <div className="col-span-2 mt-0 flex items-center gap-[8px] border-b border-zinc-100 pb-3 pt-[6px] text-[11px] font-bold uppercase tracking-[.08em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500 max-[920px]:col-span-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] text-indigo-500" strokeWidth={2}>
                <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                <path d="M14 3v6h6M8 13h8M8 17h5" />
              </svg>
              Dati offerta
            </div>

            <Campo
              label="Codice"
              name="codice"
              placeholder="Es. OFF-2026-001"
              defaultValue={offerta?.codice ?? ""}
              errore={stato.errori.codice}
              obbligatorio
              uppercase
            />

            <Campo
              label="Descrizione"
              name="descrizione"
              placeholder="Es. Percorso di coaching executive"
              defaultValue={offerta?.descrizione ?? ""}
              errore={stato.errori.descrizione}
              obbligatorio
            />

            <div className="col-span-2 mt-2 flex items-center gap-[8px] border-b border-zinc-100 pb-3 pt-[6px] text-[11px] font-bold uppercase tracking-[.08em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500 max-[920px]:col-span-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] text-indigo-500" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path d="M14.8 8.6a3.4 3.4 0 0 0-5.6 2.6 3.4 3.4 0 0 0 5.6 2.6M7.6 10.4h4.6M7.6 13h4.6" />
              </svg>
              Condizioni economiche
            </div>

            <Campo
              label="Tariffa giornaliera"
              name="tariffaGiornaliera"
              placeholder="Es. 650,00"
              defaultValue={offerta?.tariffaGiornaliera ?? ""}
              errore={stato.errori.tariffaGiornaliera}
              obbligatorio
              suffisso="€"
              hint="Importo in euro, accetta virgola o punto come separatore decimale"
            />

            <Campo
              label="Giorni previsti"
              name="giorniPrevisti"
              placeholder="Es. 10"
              defaultValue={offerta ? String(offerta.giorniPrevisti) : ""}
              errore={stato.errori.giorniPrevisti}
              obbligatorio
              suffisso="gg"
              hint="Numero intero di giornate"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-[10px] rounded-b-[11px] border-t border-zinc-200 bg-zinc-50 px-7 py-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          {!cliente.attivo && !inModifica && (
            <span className="mr-auto text-[12.5px] font-medium text-red-600 dark:text-red-400">
              Il cliente è disattivato: la creazione verrà rifiutata lato server.
            </span>
          )}
          <Link
            href={linkCliente}
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm no-underline transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Annulla
          </Link>
          <button
            type="submit"
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-indigo-500 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {inModifica ? "Salva offerta" : "Crea offerta"}
          </button>
        </div>
      </form>

      <div className="mt-[22px] flex max-w-[760px] items-start gap-[11px] rounded-[11px] border border-indigo-200 bg-indigo-50 p-[15px] text-[13px] text-zinc-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-zinc-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-[2px] h-[16px] w-[16px] shrink-0 text-indigo-600 dark:text-indigo-400" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 7.6h.01" />
        </svg>
        <span>
          <b className="text-indigo-600 dark:text-indigo-400">Nota US-008</b> — tutti i campi sono obbligatori;
          il codice deve essere univoco per cliente, la tariffa deve essere un importo decimale positivo e i giorni
          previsti un intero positivo.
        </span>
      </div>
    </div>
  );
}

interface CampoProps {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  errore?: string;
  obbligatorio?: boolean;
  uppercase?: boolean;
  suffisso?: string;
  hint?: string;
}

function Campo({
  label,
  name,
  placeholder,
  defaultValue,
  errore,
  obbligatorio,
  uppercase,
  suffisso,
  hint,
}: CampoProps) {
  return (
    <div className="mb-[18px] flex min-w-0 flex-col gap-[6px] text-left">
      <label htmlFor={name} className="text-[12.5px] font-semibold tracking-[.01em] text-zinc-600 dark:text-zinc-400">
        {label} {obbligatorio && <span className="font-bold text-red-600 dark:text-red-400">*</span>}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={`w-full rounded-[10px] border bg-white px-[13px] py-[10px] font-[inherit] text-[14px] text-zinc-800 outline-none transition placeholder:text-zinc-400 dark:bg-zinc-900 dark:text-zinc-100 ${
            suffisso ? "pr-11" : ""
          } ${
            errore
              ? "border-red-600 shadow-[0_0_0_3px_rgb(239_68_68_/_0.08)] dark:shadow-[0_0_0_3px_rgb(239_68_68_/_0.1)]"
              : "border-zinc-200 focus:border-indigo-300 focus:shadow-[0_0_0_3px_rgb(99_102_241_/_0.12)] dark:border-zinc-700 dark:focus:border-indigo-500/50"
          }`}
          style={uppercase ? { textTransform: "uppercase" } : undefined}
        />
        {suffisso && (
          <span className="pointer-events-none absolute right-[13px] top-1/2 -translate-y-1/2 text-[13px] font-semibold text-zinc-400 dark:text-zinc-500">
            {suffisso}
          </span>
        )}
      </div>
      {errore && (
        <p className="m-0 inline-flex items-center gap-[5px] text-[12px] font-semibold text-red-600 dark:text-red-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[13px] w-[13px] shrink-0" strokeWidth={2.2}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          {errore}
        </p>
      )}
      {hint && <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">{hint}</span>}
    </div>
  );
}
