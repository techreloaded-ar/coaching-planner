"use client";

import { useState } from "react";
import Link from "next/link";
import type { RisultatoReportFatturazione } from "@/lib/report";
import type { VoceClienteReport } from "@/domain/consuntivi";

// ── Formattatori ────────────────────────────────────────────────

const formattatoreEuro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const formattatoreGiornate = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Formatta una stringa importo (es. "750.00") in euro con separatori italiani. */
function formattaEuro(importo: string): string {
  return formattatoreEuro.format(Number(importo));
}

/** Iniziali della ragione sociale per il badge del cliente. */
function inizialiCliente(ragioneSociale: string): string {
  return ragioneSociale
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parola) => parola[0]?.toUpperCase() ?? "")
    .join("");
}

/** Somma le giornate fatturabili di tutte le offerte di un cliente. */
function giornateCliente(cliente: VoceClienteReport): number {
  return cliente.perOfferta.reduce(
    (totale, offerta) => totale + offerta.giornateFatturabili,
    0,
  );
}

// ── Props ───────────────────────────────────────────────────────

interface ReportFatturazioneClientiProps {
  token: string;
  tokenPrecedente: string;
  tokenSuccessivo: string;
  etichetta: string;
  report: RisultatoReportFatturazione;
}

// ── Componente ──────────────────────────────────────────────────

export default function ReportFatturazioneClienti({
  tokenPrecedente,
  tokenSuccessivo,
  etichetta,
  report,
}: ReportFatturazioneClientiProps) {
  const clienti = report.perCliente;
  const vuoto = clienti.length === 0;

  const [clienteEspansoId, setClienteEspansoId] = useState<string | null>(null);

  const giornateTotali = clienti.reduce(
    (totale, cliente) => totale + giornateCliente(cliente),
    0,
  );

  return (
    <div>
      {/* ── Barra di navigazione del mese ── */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2.5">
          <Link
            href={`/report/fatturazione-clienti?mese=${tokenPrecedente}`}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
            aria-label="Mese precedente"
            title="Mese precedente"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              className="h-[18px] w-[18px]"
            >
              <path d="m15 6-6 6 6 6" />
            </svg>
          </Link>

          <div className="min-w-[188px] text-center text-[19px] font-bold capitalize -tracking-[0.02em] text-zinc-800 dark:text-zinc-100">
            {etichetta}
          </div>

          <Link
            href={`/report/fatturazione-clienti?mese=${tokenSuccessivo}`}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
            aria-label="Mese successivo"
            title="Mese successivo"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              className="h-[18px] w-[18px]"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>

          <Link
            href="/report/fatturazione-clienti"
            className="ml-1 inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l2.5 1.5" />
            </svg>
            Mese corrente
          </Link>
        </div>

        <div className="flex-1" />

        {/* Pill riepilogo mese */}
        {!vuoto && (
          <div className="inline-flex items-center gap-[9px] rounded-full border border-indigo-200 bg-indigo-50 px-[14px] py-1.5 text-[12.5px] font-semibold text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-[15px] w-[15px]"
            >
              <path d="M3 21V8.5L9 4l6 4.5V21" />
              <path d="M15 21h6V11l-6-3" />
            </svg>
            <span>
              <b className="tabular-nums">{clienti.length}</b>{" "}
              {clienti.length === 1 ? "cliente" : "clienti"}
            </span>
            <span className="h-[13px] w-px bg-indigo-200 dark:bg-indigo-500/40" />
            <span>
              <b className="tabular-nums">
                {formattatoreGiornate.format(giornateTotali)}
              </b>{" "}
              giornate
            </span>
          </div>
        )}
      </div>

      {vuoto ? (
        /* ── Stato vuoto ── */
        <div className="rounded-[11px] border border-zinc-200 bg-white px-6 py-14 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              className="h-6 w-6"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M9 14h6M9 17h4" />
            </svg>
          </div>
          <h3 className="mb-[7px] text-[16px] font-bold text-zinc-800 dark:text-zinc-100">
            Nessuna attività da fatturare per questo mese
          </h3>
          <p className="mx-auto max-w-[420px] text-[13px] leading-relaxed text-zinc-400 dark:text-zinc-500">
            Non risultano giornate fatturabili né rimborsi trasferta registrati
            nel mese selezionato. Cambia mese o attendi la registrazione delle
            attività dei collaboratori.
          </p>
        </div>
      ) : (
        <>
          {/* ── Elenco schede per cliente ── */}
          <div className="flex flex-col gap-[18px]">
            {clienti.map((cliente) => {
              const giornate = giornateCliente(cliente);
              const espanso = clienteEspansoId === cliente.clienteId;
              return (
                <div
                  key={cliente.clienteId}
                  data-testid={`report-client-${cliente.clienteId}`}
                  className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {/* Intestazione: ragione sociale + importo totale (espande il dettaglio collaboratori) */}
                  <button
                    type="button"
                    onClick={() =>
                      setClienteEspansoId(
                        espanso ? null : cliente.clienteId,
                      )
                    }
                    aria-expanded={espanso}
                    aria-controls={`dettaglio-collaboratori-${cliente.clienteId}`}
                    aria-label={`Dettaglio collaboratori ${cliente.clienteRagioneSociale}, da fatturare ${formattaEuro(cliente.importoTotale)}`}
                    className="flex w-full flex-wrap items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-4 text-left cursor-pointer dark:border-zinc-700 dark:bg-zinc-800/60"
                  >
                    <div className="flex min-w-0 items-center gap-[13px]">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-indigo-50 text-[14px] font-extrabold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                        {inizialiCliente(cliente.clienteRagioneSociale)}
                      </div>
                      <div className="min-w-0 leading-[1.3]">
                        <b className="block text-[16px] font-bold -tracking-[0.01em] text-zinc-800 dark:text-zinc-100">
                          {cliente.clienteRagioneSociale}
                        </b>
                        <span className="text-[12px] tabular-nums text-zinc-400 dark:text-zinc-500">
                          {formattatoreGiornate.format(giornate)} giornate
                          fatturabili
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right leading-[1.15]">
                        <span className="mb-[3px] block text-[10.5px] font-bold uppercase tracking-[0.05em] text-zinc-400 dark:text-zinc-500">
                          Da fatturare
                        </span>
                        <span className="text-[26px] font-extrabold -tracking-[0.03em] tabular-nums text-indigo-600 dark:text-indigo-400">
                          {formattaEuro(cliente.importoTotale)}
                        </span>
                      </div>
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform dark:text-zinc-500 ${
                          espanso ? "rotate-180" : ""
                        }`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </button>

                  {/* Tabella dettaglio per offerta */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[13.5px]">
                      <thead>
                        <tr>
                          <th className="border-b border-zinc-200 bg-white px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                            Offerta
                          </th>
                          <th className="border-b border-zinc-200 bg-white px-5 py-[11px] text-right text-[10.5px] font-bold uppercase tracking-[0.05em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                            Tariffa/gg
                          </th>
                          <th className="border-b border-zinc-200 bg-white px-5 py-[11px] text-right text-[10.5px] font-bold uppercase tracking-[0.05em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                            Giornate
                          </th>
                          <th className="border-b border-zinc-200 bg-white px-5 py-[11px] text-right text-[10.5px] font-bold uppercase tracking-[0.05em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                            Imponibile
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cliente.perOfferta.map((offerta) => (
                          <tr
                            key={offerta.offertaId}
                            className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          >
                            <td className="border-b border-zinc-100 px-5 py-[13px] align-middle dark:border-zinc-700/50">
                              <div className="flex min-w-0 flex-col gap-1">
                                <span className="inline-block w-fit rounded-[6px] border border-zinc-200 bg-zinc-50 px-2 py-[2px] text-[11px] font-bold whitespace-nowrap text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                                  {offerta.offertaCodice}
                                </span>
                                <span className="text-[12.5px] leading-snug text-zinc-500 dark:text-zinc-400">
                                  {offerta.offertaDescrizione}
                                </span>
                              </div>
                            </td>
                            <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle tabular-nums whitespace-nowrap text-zinc-500 dark:border-zinc-700/50 dark:text-zinc-400">
                              {formattaEuro(offerta.tariffaGiornaliera)}
                            </td>
                            <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle font-bold tabular-nums whitespace-nowrap text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                              {formattatoreGiornate.format(
                                offerta.giornateFatturabili,
                              )}
                            </td>
                            <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle text-[14px] font-bold tabular-nums whitespace-nowrap text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                              {formattaEuro(offerta.imponibile)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Dettaglio collaboratori per offerta (espandibile). Il nodo resta
                      sempre nel DOM, nascosto con `hidden` quando collassato, così
                      aria-controls del bottone punta sempre a un id esistente. */}
                  <section
                    role="region"
                    id={`dettaglio-collaboratori-${cliente.clienteId}`}
                    aria-label={`Dettaglio collaboratori ${cliente.clienteRagioneSociale}`}
                    hidden={!espanso}
                    className="border-b border-zinc-200 bg-zinc-50/60 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800/40"
                  >
                    <div className="mb-3 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.05em] text-zinc-400 dark:text-zinc-500">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="h-[14px] w-[14px]"
                        >
                          <circle cx="9" cy="8" r="3.2" />
                          <path d="M2.8 19a6.2 6.2 0 0 1 12.4 0" />
                          <circle cx="17.2" cy="9.2" r="2.4" />
                          <path d="M15.5 14.3a5 5 0 0 1 5.7 4.7" />
                        </svg>
                        Ore erogate per collaboratore
                      </div>

                      {cliente.perOfferta.length === 0 ? (
                        <p className="text-[13px] italic text-zinc-400 dark:text-zinc-500">
                          Nessuna ora fatturabile nel mese: il cliente compare
                          solo per rimborsi trasferta
                        </p>
                      ) : (
                        <div className="flex flex-col gap-5">
                          {cliente.perOfferta.map((offerta) => (
                            <div
                              key={offerta.offertaId}
                              data-testid={`dettaglio-offerta-${offerta.offertaCodice}`}
                            >
                              <div className="mb-2 flex min-w-0 flex-col gap-1">
                                <span className="inline-block w-fit rounded-[6px] border border-zinc-200 bg-zinc-50 px-2 py-[2px] text-[11px] font-bold whitespace-nowrap text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                                  {offerta.offertaCodice}
                                </span>
                                <span className="text-[12.5px] leading-snug text-zinc-500 dark:text-zinc-400">
                                  {offerta.offertaDescrizione}
                                </span>
                              </div>
                              <div className="overflow-x-auto rounded-[8px] border border-zinc-200 dark:border-zinc-700">
                                <table className="w-full border-collapse text-[13px]">
                                  <thead>
                                    <tr>
                                      <th className="border-b border-zinc-200 bg-white px-4 py-2 text-left text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                                        Collaboratore
                                      </th>
                                      <th className="border-b border-zinc-200 bg-white px-4 py-2 text-right text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                                        Ore fatturabili
                                      </th>
                                      <th className="border-b border-zinc-200 bg-white px-4 py-2 text-right text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                                        Giornate
                                      </th>
                                      <th className="border-b border-zinc-200 bg-white px-4 py-2 text-right text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                                        Imponibile
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {offerta.perCollaboratore.map((voce) => (
                                      <tr
                                        key={voce.collaboratoreId}
                                        className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                                      >
                                        <td className="border-b border-zinc-100 px-4 py-[9px] align-middle font-semibold text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                                          {voce.collaboratoreNome}
                                        </td>
                                        <td className="border-b border-zinc-100 px-4 py-[9px] text-right align-middle tabular-nums whitespace-nowrap text-zinc-500 dark:border-zinc-700/50 dark:text-zinc-400">
                                          {formattatoreGiornate.format(
                                            voce.oreFatturabili,
                                          )}{" "}
                                          h
                                        </td>
                                        <td className="border-b border-zinc-100 px-4 py-[9px] text-right align-middle font-bold tabular-nums whitespace-nowrap text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                                          {formattatoreGiornate.format(
                                            voce.giornateFatturabili,
                                          )}{" "}
                                          gg
                                        </td>
                                        <td className="border-b border-zinc-100 px-4 py-[9px] text-right align-middle font-bold tabular-nums whitespace-nowrap text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                                          {formattaEuro(voce.imponibile)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </section>

                  {/* Rimborsi trasferta ribaltati */}
                  <div className="flex items-center justify-between gap-[14px] border-b border-zinc-100 bg-white px-5 py-3 dark:border-zinc-700/50 dark:bg-zinc-800">
                    <div className="flex items-center gap-[9px] text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className="h-4 w-4 text-zinc-400 dark:text-zinc-500"
                      >
                        <path d="M3 12h18M3 12l4-4M3 12l4 4" />
                        <path d="M21 6v12" />
                      </svg>
                      Rimborsi trasferta ribaltati
                    </div>
                    <span
                      data-testid={`report-client-${cliente.clienteId}-rimborsi`}
                      className="text-[14px] font-bold tabular-nums text-zinc-800 dark:text-zinc-100"
                    >
                      {formattaEuro(cliente.rimborsiTrasferta)}
                    </span>
                  </div>

                  {/* Totale da fatturare del cliente */}
                  <div className="flex items-center justify-between gap-[14px] border-t border-indigo-200 bg-indigo-50 px-5 py-[15px] dark:border-indigo-500/40 dark:bg-indigo-500/10">
                    <div className="flex items-center gap-[9px] text-[12px] font-bold uppercase tracking-[0.04em] text-indigo-700 dark:text-indigo-300">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        className="h-4 w-4"
                      >
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                      Totale da fatturare
                    </div>
                    <span
                      data-testid={`report-client-${cliente.clienteId}-totale`}
                      className="text-[20px] font-extrabold -tracking-[0.02em] tabular-nums text-indigo-600 dark:text-indigo-400"
                    >
                      {formattaEuro(cliente.importoTotale)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Scheda totale complessivo del mese ── */}
          <div className="relative mt-[22px] overflow-hidden rounded-[11px] border border-indigo-700 bg-gradient-to-br from-indigo-500 to-indigo-700 px-6 py-[22px] text-white shadow-lg">
            <div className="mb-4 flex items-center gap-[9px] text-[11.5px] font-bold uppercase tracking-[0.06em] text-white/80">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                className="h-4 w-4"
              >
                <path d="M3 3v18h18" />
                <path d="M7.5 15.5v-4M12 15.5V7.5M16.5 15.5v-6" />
              </svg>
              Totale complessivo da fatturare — {etichetta}
            </div>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="flex flex-wrap items-stretch">
                <div className="mr-[26px] border-r border-white/20 pr-[26px]">
                  <div className="mb-[5px] text-[11.5px] font-semibold text-white/80">
                    Imponibile manodopera
                  </div>
                  <div
                    data-testid="report-total-imponibile"
                    className="text-[19px] font-bold -tracking-[0.02em] tabular-nums"
                  >
                    {formattaEuro(report.totali.imponibileManodopera)}
                  </div>
                </div>
                <div>
                  <div className="mb-[5px] text-[11.5px] font-semibold text-white/80">
                    Totale rimborsi
                  </div>
                  <div
                    data-testid="report-total-rimborsi"
                    className="text-[19px] font-bold -tracking-[0.02em] tabular-nums"
                  >
                    {formattaEuro(report.totali.totaleRimborsi)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="mb-1 text-[11.5px] font-bold uppercase tracking-[0.05em] text-white/80">
                  Importo totale
                </div>
                <div
                  data-testid="report-total-importo"
                  className="text-[38px] leading-none font-extrabold -tracking-[0.04em] tabular-nums"
                >
                  {formattaEuro(report.totali.importoTotale)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
