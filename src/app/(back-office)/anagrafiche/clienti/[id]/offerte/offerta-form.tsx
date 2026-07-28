"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  creaOfferta,
  aggiornaOfferta,
  type StatoActionOfferta,
} from "./actions";
import { LUNGHEZZA_MASSIMA_CODICE } from "@/domain/anagrafiche/valida-offerta";

interface OffertaFormProps {
  /**
   * Cliente fisso a cui è associata l'offerta. Presente quando il form è aperto
   * dalla scheda cliente (US-008) o in modifica dalla pagina offerte (cliente
   * non modificabile). In creazione dalla pagina offerte è assente e il cliente
   * si sceglie tramite la prop `clienti`.
   */
  cliente?: {
    id: string;
    ragioneSociale: string;
    attivo: boolean;
  };
  /**
   * Elenco dei clienti attivi selezionabili. Quando presente, il form mostra una
   * select "Cliente" al posto del cliente fisso (creazione dalla pagina offerte).
   */
  clienti?: {
    id: string;
    ragioneSociale: string;
  }[];
  offerta?: {
    id: string;
    codice: string;
    descrizione: string;
    tariffaGiornaliera: string;
    giorniPrevisti: number;
  };
  /**
   * Origine della navigazione. Con "offerte" il form torna alla pagina
   * trasversale /offerte al termine dell'operazione.
   */
  origine?: string;
}

const statoIniziale: StatoActionOfferta = { errori: {} };

export default function OffertaForm({
  cliente,
  clienti,
  offerta,
  origine,
}: OffertaFormProps) {
  const inModifica = !!offerta;
  const [stato, azione] = useActionState(
    inModifica ? aggiornaOfferta : creaOfferta,
    statoIniziale
  );

  const provieneDaOfferte = origine === "offerte";
  const mostraSelectCliente = !!clienti;
  const linkRitorno = provieneDaOfferte
    ? "/offerte"
    : `/anagrafiche/clienti/${cliente?.id ?? ""}`;
  const testoRitorno = provieneDaOfferte ? "Torna alle offerte" : "Torna al cliente";
  const briciole = provieneDaOfferte
    ? "Anagrafiche · Offerte"
    : "Anagrafiche · Clienti · Offerte";
  const titoloAzione = inModifica ? "Modifica offerta" : "Nuova offerta";
  const titolo =
    provieneDaOfferte || !cliente
      ? titoloAzione
      : `${cliente.ragioneSociale} — ${titoloAzione}`;
  const haErrori = Object.keys(stato.errori).length > 0;

  return (
    <div>
      <Link
        href={linkRitorno}
        className="mb-[14px] inline-flex items-center gap-[6px] text-[13px] font-semibold text-zinc-600 no-underline transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2.2}>
          <path d="M19 12H5m6 6-6-6 6-6" />
        </svg>
        {testoRitorno}
      </Link>

      <div className="mb-[22px]">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
          {briciole}
        </div>
        <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
          {titolo}
        </h1>
        {cliente && (
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
            {provieneDaOfferte && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="h-[13px] w-[13px]"
                strokeWidth={2}
                aria-label="Cliente non modificabile"
              >
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            )}
          </div>
        )}
      </div>

      <form
        noValidate
        action={azione}
        className="max-w-[760px] rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        {!mostraSelectCliente && cliente && (
          <input type="hidden" name="clienteId" value={cliente.id} />
        )}
        {origine && <input type="hidden" name="origine" value={origine} />}
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
            {mostraSelectCliente && (
              <>
                <div className="col-span-2 mt-0 flex items-center gap-[8px] border-b border-zinc-100 pb-3 pt-[6px] text-[11px] font-bold uppercase tracking-[.08em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500 max-[920px]:col-span-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] text-indigo-500" strokeWidth={2}>
                    <circle cx="9" cy="8" r="3.4" />
                    <path d="M2.8 19.4a6.2 6.2 0 0 1 12.4 0" />
                    <circle cx="17.2" cy="9.4" r="2.6" />
                    <path d="M15.4 14.6a5 5 0 0 1 5.8 4.8" />
                  </svg>
                  Cliente
                </div>
                <SelectCliente
                  clienti={clienti!}
                  errore={stato.errori.clienteId}
                />
              </>
            )}

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
              maxLength={LUNGHEZZA_MASSIMA_CODICE}
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
          {cliente && !cliente.attivo && !inModifica && (
            <span className="mr-auto text-[12.5px] font-medium text-red-600 dark:text-red-400">
              Il cliente è disattivato: non puoi creare nuove offerte.
            </span>
          )}
          <Link
            href={linkRitorno}
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


    </div>
  );
}

interface SelectClienteProps {
  clienti: { id: string; ragioneSociale: string }[];
  errore?: string;
}

function SelectCliente({ clienti, errore }: SelectClienteProps) {
  return (
    <div className="col-span-2 mb-[18px] flex min-w-0 flex-col gap-[6px] text-left max-[920px]:col-span-1">
      <label
        htmlFor="clienteId"
        className="text-[12.5px] font-semibold tracking-[.01em] text-zinc-600 dark:text-zinc-400"
      >
        Cliente <span className="font-bold text-red-600 dark:text-red-400">*</span>
      </label>
      <select
        id="clienteId"
        name="clienteId"
        defaultValue=""
        className={`w-full rounded-[10px] border bg-white px-[13px] py-[10px] font-[inherit] text-[14px] text-zinc-800 outline-none transition dark:bg-zinc-900 dark:text-zinc-100 ${
          errore
            ? "border-red-600 shadow-[0_0_0_3px_rgb(239_68_68_/_0.08)] dark:shadow-[0_0_0_3px_rgb(239_68_68_/_0.1)]"
            : "border-zinc-200 focus:border-indigo-300 focus:shadow-[0_0_0_3px_rgb(99_102_241_/_0.12)] dark:border-zinc-700 dark:focus:border-indigo-500/50"
        }`}
      >
        <option value="" disabled>
          Seleziona un cliente
        </option>
        {clienti.map((cliente) => (
          <option key={cliente.id} value={cliente.id}>
            {cliente.ragioneSociale}
          </option>
        ))}
      </select>
      {errore && (
        <p className="m-0 inline-flex items-center gap-[5px] text-[12px] font-semibold text-red-600 dark:text-red-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[13px] w-[13px] shrink-0" strokeWidth={2.2}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          {errore}
        </p>
      )}
      <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
        Sono elencati solo i clienti attivi
      </span>
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
  maxLength?: number;
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
  maxLength,
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
          maxLength={maxLength}
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
