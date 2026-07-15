"use client";

import { useState } from "react";
import Link from "next/link";
import type { VoceElencoOfferta } from "@/lib/offerte";

// ── Formattatori ────────────────────────────────────────────────

const formattatoreGiornate = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const formattatoreEuro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatta un numero di giornate con al massimo un decimale, stile it-IT. */
function formattaGiornate(valore: number): string {
  return formattatoreGiornate.format(valore);
}

/** Iniziali della ragione sociale del cliente per l'avatar quadrato. */
function inizialiCliente(ragioneSociale: string): string {
  return ragioneSociale
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parola) => parola[0]?.toUpperCase() ?? "")
    .join("");
}

/** Un'offerta attiva è critica quando ha esaurito o superato il budget. */
function eCritica(offerta: VoceElencoOfferta): boolean {
  return offerta.attiva && offerta.residuo <= 0;
}

// ── Props ───────────────────────────────────────────────────────

interface OfferteTabellaProps {
  offerte: VoceElencoOfferta[];
}

// ── Componente ──────────────────────────────────────────────────

export default function OfferteTabella({ offerte }: OfferteTabellaProps) {
  const [filtro, setFiltro] = useState("");

  if (offerte.length === 0) {
    return <StatoVuoto />;
  }

  const filtroLower = filtro.trim().toLowerCase();
  const offerteFiltrate = offerte.filter(
    (offerta) =>
      !filtroLower ||
      offerta.clienteRagioneSociale.toLowerCase().includes(filtroLower) ||
      offerta.codice.toLowerCase().includes(filtroLower) ||
      offerta.descrizione.toLowerCase().includes(filtroLower),
  );

  const attive = offerteFiltrate.filter((o) => o.attiva).length;
  const nonAttive = offerteFiltrate.length - attive;
  const critiche = offerteFiltrate.filter(eCritica).length;

  return (
    <section className="rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Toolbar: ricerca + pill critiche + contatore riepilogo */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-[14px] dark:border-zinc-800">
        <label className="flex flex-1 items-center gap-2 rounded-[10px] border border-zinc-200 bg-zinc-100 px-3 py-2 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 max-w-[360px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px] shrink-0" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.3-3.3" />
          </svg>
          <input
            type="search"
            placeholder="Cerca per cliente, codice o descrizione…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full border-0 bg-transparent font-[inherit] text-[13.5px] text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            aria-label="Cerca offerta"
          />
        </label>
        {critiche > 0 && (
          <span className="inline-flex items-center gap-[7px] rounded-full border border-red-200 bg-red-50 px-[12px] py-[5px] text-[12px] font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2}>
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <span>
              <b className="tabular-nums">{critiche}</b> da presidiare
            </span>
          </span>
        )}
        <span className="ml-auto text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
          {offerteFiltrate.length}{" "}
          {offerteFiltrate.length === 1 ? "offerta" : "offerte"} · {attive} attive ·{" "}
          {nonAttive} non attive
        </span>
      </div>

      {/* Tabella trasversale */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]" aria-label="Elenco offerte">
          <thead>
            <tr>
              <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Offerta
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Cliente
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Tariffa giornaliera
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Giorni previsti
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Erogate
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Residuo
              </th>
              <th className="w-[120px] whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Stato
              </th>
            </tr>
          </thead>
          <tbody>
            {offerteFiltrate.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-[34px] text-center text-[13px] text-zinc-400 dark:text-zinc-500">
                  Nessuna offerta corrisponde alla ricerca.
                </td>
              </tr>
            ) : (
              offerteFiltrate.map((offerta) => (
                <RigaOfferta key={offerta.offertaId} offerta={offerta} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Riga ────────────────────────────────────────────────────────

function RigaOfferta({ offerta }: { offerta: VoceElencoOfferta }) {
  const oltreBudget = offerta.residuo < 0;
  const esaurita = offerta.residuo === 0 && offerta.giorniPrevisti > 0;
  const critica = oltreBudget || esaurita;
  const percentuale =
    offerta.giorniPrevisti > 0
      ? Math.min((offerta.giornateErogate / offerta.giorniPrevisti) * 100, 100)
      : 0;

  const residuoTesto =
    (offerta.residuo < 0 ? "−" : "") + formattaGiornate(Math.abs(offerta.residuo));

  return (
    <tr
      className={`border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 ${
        !offerta.attiva ? "opacity-60" : ""
      }`}
    >
      {/* Offerta: badge codice + descrizione */}
      <td className="px-4 py-[13px] align-middle">
        <div className="flex min-w-0 flex-col gap-[5px] leading-[1.3]">
          <span className="inline-block w-fit rounded-[6px] border border-zinc-200 bg-white px-2 py-[2px] text-[11px] font-bold whitespace-nowrap text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            {offerta.codice}
          </span>
          <span
            className="max-w-[340px] truncate text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-100"
            title={offerta.descrizione}
          >
            {offerta.descrizione}
          </span>
        </div>
      </td>

      {/* Cliente */}
      <td className="px-4 py-[13px] align-middle">
        <div className="flex min-w-0 items-center gap-[10px]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-zinc-200 bg-zinc-50 text-[11px] font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-300">
            {inizialiCliente(offerta.clienteRagioneSociale)}
          </span>
          <span
            className="truncate text-[13.5px] text-zinc-700 dark:text-zinc-200"
            title={offerta.clienteRagioneSociale}
          >
            {offerta.clienteRagioneSociale}
          </span>
        </div>
      </td>

      {/* Tariffa giornaliera */}
      <td className="px-4 py-[13px] text-right align-middle tabular-nums whitespace-nowrap font-semibold text-zinc-700 dark:text-zinc-200">
        {formattatoreEuro.format(Number(offerta.tariffaGiornaliera))}
      </td>

      {/* Giorni previsti */}
      <td className="px-4 py-[13px] text-right align-middle tabular-nums whitespace-nowrap text-zinc-600 dark:text-zinc-300">
        {formattaGiornate(offerta.giorniPrevisti)}
        <span className="ml-[3px] text-[11.5px] text-zinc-400 dark:text-zinc-500">gg</span>
      </td>

      {/* Erogate + mini barra */}
      <td className="px-4 py-[13px] text-right align-middle whitespace-nowrap">
        <div className="inline-flex flex-col items-end gap-[5px]">
          <span className="tabular-nums font-bold text-zinc-800 dark:text-zinc-100">
            {formattaGiornate(offerta.giornateErogate)}
            <span className="ml-[3px] text-[11.5px] font-semibold text-zinc-400 dark:text-zinc-500">
              gg
            </span>
          </span>
          <span
            className="relative h-[5px] w-[72px] overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700/50"
            role="img"
            aria-label={`Erogato ${Math.round(percentuale)}% del previsto`}
          >
            <span
              className={`absolute inset-y-0 left-0 rounded-full ${
                oltreBudget
                  ? "bg-[repeating-linear-gradient(45deg,theme(colors.red.500)_0_6px,theme(colors.red.700)_6px_12px)]"
                  : esaurita
                    ? "bg-red-500"
                    : "bg-indigo-500"
              }`}
              style={{ width: `${percentuale}%` }}
            />
          </span>
        </div>
      </td>

      {/* Residuo */}
      <td className="px-4 py-[13px] text-right align-middle whitespace-nowrap">
        <div className="inline-flex flex-col items-end gap-[3px]">
          <span
            className={`tabular-nums font-bold ${
              critica ? "text-red-600 dark:text-red-400" : "text-zinc-700 dark:text-zinc-200"
            }`}
          >
            {residuoTesto}
            <span className="ml-[3px] text-[11.5px] font-semibold opacity-70">gg</span>
          </span>
          {oltreBudget && (
            <span className="inline-flex items-center gap-[4px] text-[11px] font-bold text-red-600 dark:text-red-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[12px] w-[12px]" strokeWidth={2.2}>
                <path d="M12 5v14M5 12l7-7 7 7" />
              </svg>
              Oltre budget
            </span>
          )}
          {esaurita && (
            <span className="inline-flex items-center gap-[4px] text-[11px] font-bold text-red-600 dark:text-red-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[12px] w-[12px]" strokeWidth={2.2}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" />
              </svg>
              Esaurita
            </span>
          )}
        </div>
      </td>

      {/* Stato attiva/non attiva */}
      <td className="px-4 py-[13px] align-middle">
        {offerta.attiva ? (
          <span className="inline-flex items-center gap-[5px] rounded-full bg-emerald-50 px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <span className="h-[6px] w-[6px] rounded-full bg-current" />
            Attiva
          </span>
        ) : (
          <span className="inline-flex items-center gap-[5px] rounded-full border border-zinc-200 bg-zinc-100 px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
            <span className="h-[6px] w-[6px] rounded-full bg-current" />
            Non attiva
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Stato vuoto ─────────────────────────────────────────────────

function StatoVuoto() {
  return (
    <div className="rounded-[11px] border border-zinc-200 bg-white px-6 py-14 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
          <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
          <path d="M14 3v6h6M8 13h8M8 17h5" />
        </svg>
      </div>
      <h3 className="mb-[7px] text-[16px] font-bold text-zinc-800 dark:text-zinc-100">
        Nessuna offerta presente
      </h3>
      <p className="mx-auto max-w-[440px] text-[13px] leading-relaxed text-zinc-400 dark:text-zinc-500">
        Non risultano offerte per nessun cliente. Le offerte si creano dalla scheda
        del cliente: apri un cliente dall&apos;anagrafica e aggiungi la sua prima
        offerta con codice, descrizione, tariffa giornaliera e giorni previsti.
      </p>
      <div className="mt-5">
        <Link
          href="/anagrafiche/clienti"
          className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[15px] py-[9px] text-[13.5px] font-semibold text-white no-underline shadow-sm transition hover:bg-indigo-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
            <path d="M3 21V8.5L9 4l6 4.5V21" />
            <path d="M15 21h6V11l-6-3" />
          </svg>
          Vai ai clienti
        </Link>
      </div>
    </div>
  );
}
