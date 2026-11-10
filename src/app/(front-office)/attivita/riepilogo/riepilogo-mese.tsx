"use client";

import Link from "next/link";
import { IndicatoreGiorniErogati } from "@/components";
import { urlDelFoglio } from "@/lib/url-foglio-attivita";
import { useCollaboratoreConsultato } from "../attivita-cache-provider";
import type { RisultatoRiepilogoMese } from "@/lib/attivita";
import type { VoceRiepilogoOfferta } from "@/domain/consuntivi";
import {
  CATEGORIE_ATTIVITA,
  DESCRIZIONE_CATEGORIA_ATTIVITA,
  ETICHETTA_OFFERTA_DA_DEFINIRE,
} from "@/domain/types";
import { formattaGiornate, formattaNumeroGiornate, formattaNumeroOre, formattaOre } from "@/lib/formattazione";

interface RiepilogoMeseProps {
  token: string;
  tokenPrecedente: string;
  tokenSuccessivo: string;
  etichetta: string;
  riepilogo: RisultatoRiepilogoMese;
}

function formattaNumero(valore: number, opzioni?: Intl.NumberFormatOptions): string {
  return valore.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...opzioni,
  });
}

function formattaEuro(importo: string): string {
  return `€ ${Number(importo).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Segnala le ore dell'offerta che non sono nella categoria Fatturabile. */
function badgeCategorieNonFatturabili(voce: VoceRiepilogoOfferta) {
  return (["NON_FATTURABILE", "INVESTIMENTO"] as const)
    .filter((categoria) => voce.orePerCategoria[categoria] > 0)
    .map(
      (categoria) =>
        `${DESCRIZIONE_CATEGORIA_ATTIVITA[categoria].etichetta} ${formattaOre(voce.orePerCategoria[categoria])}`,
    );
}

export default function RiepilogoMese({
  token,
  tokenPrecedente,
  tokenSuccessivo,
  etichetta,
  riepilogo,
}: RiepilogoMeseProps) {
  const haDati = riepilogo.perOfferta.length > 0;
  const percentuale = riepilogo.breakdown.modalitaTariffa === "PERCENTUALE";
  const percentualeTrattenuta = `${formattaNumero(Number(riepilogo.breakdown.importoTariffa))}%`;
  const collaboratoreConsultatoId = useCollaboratoreConsultato();

  return (
    <div className="mx-auto w-full max-w-[1080px] px-8 py-7 max-md:px-4 max-md:py-5">
      <div className="mb-5">
        <Link
          href={urlDelFoglio(`/attivita?mese=${token}`, collaboratoreConsultatoId)}
          className="inline-flex items-center gap-[7px] text-sm font-medium text-testo-metadati transition hover:text-rose-800 dark:hover:text-rose-300"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            className="h-4 w-4"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Torna al calendario
        </Link>
      </div>

      <div className="mb-[18px] flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2.5">
          <Link
            href={urlDelFoglio(`/attivita/riepilogo?mese=${tokenPrecedente}`, collaboratoreConsultatoId)}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-testo-metadati shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Mese precedente"
            title="Mese precedente"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[18px] w-[18px]">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </Link>

          <div className="min-w-[188px] text-center text-[19px] font-semibold capitalize -tracking-[0.02em] text-testo-principale">
            {etichetta}
          </div>

          <Link
            href={urlDelFoglio(`/attivita/riepilogo?mese=${tokenSuccessivo}`, collaboratoreConsultatoId)}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-testo-metadati shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Mese successivo"
            title="Mese successivo"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[18px] w-[18px]">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>

          <Link
            href={urlDelFoglio("/attivita/riepilogo", collaboratoreConsultatoId)}
            className="ml-1 inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-medium text-testo-metadati shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l2.5 1.5" />
            </svg>
            Mese corrente
          </Link>
        </div>

        <div className="flex-1" />

        <div className="inline-flex items-center gap-[9px] rounded-full border border-rose-200 bg-rose-50 px-[13px] py-1.5 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[15px] w-[15px]">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
          <b className="tabular-nums">
            {riepilogo.perOfferta.filter((voce) => voce.offertaId !== null).length} offerte
          </b>
          <span className="block h-[13px] w-px bg-rose-200 dark:bg-rose-800" />
          <b className="tabular-nums">{formattaNumeroGiornate(riepilogo.totali.giornateTotali)} gg</b>
        </div>
      </div>

      <div className="mb-1">
        <div className="inline-flex items-center gap-[7px] text-sm font-semibold text-rose-800 dark:text-rose-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[15px] w-[15px]">
            <rect x="3" y="4" width="18" height="17" rx="2.5" />
            <path d="M3 9h18M8 2v4M16 2v4" />
          </svg>
          Riepilogo mensile
        </div>
        <h2 className="mt-1.5 text-[27px] font-semibold capitalize tracking-tight text-testo-principale max-md:text-[23px]">
          {etichetta}
        </h2>
      </div>

      <div className="mt-[18px] grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div data-testid="summary-giornate-totali" className="rounded-[11px] border border-zinc-200 bg-white p-[16px_18px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-xs font-medium text-testo-metadati">Giornate totali</div>
          <div data-testid="summary-giornate-totali-value" className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-testo-principale">
            {formattaNumeroGiornate(riepilogo.totali.giornateTotali)}
          </div>
        </div>

        <div data-testid="summary-giornate-da-fatturare" className="rounded-[11px] border border-zinc-200 bg-white p-[16px_18px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-xs font-medium text-testo-metadati">Giornate da fatturare</div>
          <div data-testid="summary-giornate-da-fatturare-value" className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-testo-principale">
            {formattaNumeroGiornate(riepilogo.totali.giornateDaFatturare)}
          </div>
          <div className="text-xs text-testo-metadati">
            {riepilogo.breakdown.modalitaTariffa === "GIORNALIERA"
              ? `Tariffa giorno: ${formattaEuro(riepilogo.breakdown.importoTariffa)}`
              : riepilogo.breakdown.modalitaTariffa === "FISSO_MENSILE"
                ? "Il fisso mensile non dipende dalle giornate"
                : riepilogo.breakdown.modalitaTariffa === "PERCENTUALE"
                  ? `Percentuale trattenuta: ${percentualeTrattenuta}`
                  : "Nessuna tariffa in vigore"}
          </div>
        </div>

        <div data-testid="summary-ore-per-categoria" className="rounded-[11px] border border-zinc-200 bg-white p-[16px_18px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-xs font-medium text-testo-metadati">Ore per categoria</div>
          <dl className="mt-2 space-y-1 text-sm">
            {CATEGORIE_ATTIVITA.map((categoria) => (
              <div key={categoria} className="flex justify-between gap-3">
                <dt className="text-testo-metadati">{DESCRIZIONE_CATEGORIA_ATTIVITA[categoria].etichetta}</dt>
                <dd className="font-semibold tabular-nums text-testo-principale">{formattaNumeroOre(riepilogo.totali.orePerCategoria[categoria])} h</dd>
              </div>
            ))}
          </dl>
        </div>

        <div data-testid="summary-rimborsi" className="rounded-[11px] border border-zinc-200 bg-white p-[16px_18px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-xs font-medium text-testo-metadati">Totale rimborsi trasferta</div>
          <div data-testid="summary-rimborsi-value" className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-testo-principale">
            {formattaEuro(riepilogo.totali.totaleRimborsi)}
          </div>
          <div className="text-xs text-testo-metadati">Somma delle trasferte del mese</div>
        </div>

        <div data-testid="summary-importo-fattura" className="overflow-hidden rounded-[11px] border border-rose-600 bg-gradient-to-br from-rose-600 to-rose-700 p-[18px_20px] text-white shadow-[0_12px_40px_rgba(24,24,27,0.16)] md:col-span-2 xl:col-span-4 dark:from-rose-500 dark:to-rose-600">
          <div className="text-xs font-medium text-white/80">Importo fattura</div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div data-testid="summary-importo-fattura-value" className="text-[38px] font-semibold tabular-nums tracking-tight">{formattaEuro(riepilogo.importoFattura)}</div>
            <div data-testid="summary-importo-fattura-breakdown" className="flex flex-wrap items-center gap-3 text-sm font-medium text-white/85">
              {riepilogo.breakdown.modalitaTariffa === "FISSO_MENSILE" ? (
                <span>Fisso mensile {formattaEuro(riepilogo.breakdown.importoTariffa)}</span>
              ) : percentuale ? (
                <>
                  <span>{formattaGiornate(Number(riepilogo.breakdown.giornateDaFatturare))} fatturabili</span>
                  <span className="h-4 w-px bg-white/25" />
                  <span>Compenso {formattaEuro(riepilogo.breakdown.imponibileManodopera)}</span>
                </>
              ) : (
                <>
                  <span>{formattaGiornate(Number(riepilogo.breakdown.giornateDaFatturare))} × {formattaEuro(riepilogo.breakdown.importoTariffa)}</span>
                  <span className="h-4 w-px bg-white/25" />
                  <span>Compenso {formattaEuro(riepilogo.breakdown.imponibileManodopera)}</span>
                </>
              )}
              <span className="h-4 w-px bg-white/25" />
              <span>Rimborsi {formattaEuro(riepilogo.breakdown.totaleRimborsi)}</span>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-[30px]">
        <div className="mb-[13px] flex items-center gap-2">
          <h3 className="text-[15px] font-semibold text-testo-principale">Dettaglio per offerta</h3>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-[9px] py-[2px] text-xs font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
            {riepilogo.perOfferta.length}
          </span>
        </div>

        {!haDati ? (
          <div className="rounded-[11px] border border-dashed border-zinc-200 bg-zinc-50 p-[32px_20px] text-center text-sm text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800/50">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-2.5 h-8 w-8 opacity-40">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Nessuna attività registrata per questo mese.
          </div>
        ) : (
          <div data-testid="summary-table" className="overflow-x-auto rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                  <th className="px-3.5 py-3 text-left text-xs font-medium text-testo-metadati">Cliente</th>
                  <th className="px-3.5 py-3 text-left text-xs font-medium text-testo-metadati">Offerta</th>
                  <th className="px-3.5 py-3 text-right text-xs font-medium text-testo-metadati">Giornate totali</th>
                  <th className="px-3.5 py-3 text-right text-xs font-medium text-testo-metadati">Giornate da fatturare</th>
                  <th className="px-3.5 py-3 text-right text-xs font-medium text-testo-metadati">Rimborsi trasferta</th>
                  {percentuale && (
                    <th className="px-3.5 py-3 text-right text-xs font-medium text-testo-metadati">Compenso ({percentualeTrattenuta} trattenuto)</th>
                  )}
                  <th className="px-3.5 py-3 text-right text-xs font-medium text-testo-metadati">Giorni erogati</th>
                </tr>
              </thead>
              <tbody>
                {riepilogo.perOfferta.map((voce) => {
                  const badge = badgeCategorieNonFatturabili(voce);
                  // Avanzamento a oggi dell'intera offerta, come nell'anagrafica.
                  const avanzamento =
                    voce.offertaId === null ? undefined : riepilogo.avanzamentoPerOfferta[voce.offertaId];

                  return (
                    <tr
                      key={voce.offertaId ?? `senza-offerta|${voce.clienteId}`}
                      className="border-b border-zinc-100 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                    >
                      <td className="px-3.5 py-3 align-top text-sm font-semibold text-testo-principale">
                        {voce.clienteRagioneSociale}
                      </td>
                      <td className="px-3.5 py-3 align-top">
                        <div className="flex min-w-0 flex-col gap-1">
                          {voce.offertaId === null ? (
                            <span
                              data-testid="riepilogo-offerta-da-definire"
                              className="w-fit rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            >
                              {ETICHETTA_OFFERTA_DA_DEFINIRE}
                            </span>
                          ) : (
                            <span className="w-fit rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-testo-secondario dark:border-zinc-700 dark:bg-zinc-800">
                              {[voce.offertaCodice, voce.offertaDescrizione].filter(Boolean).join(" — ")}
                            </span>
                          )}
                          {badge.map((testo) => (
                            <span key={testo} className="mt-1 inline-flex w-fit rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800">
                              {testo}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-right font-semibold tabular-nums text-testo-principale">
                        {formattaNumeroGiornate(voce.giornateTotali)}
                      </td>
                      <td className="px-3.5 py-3 text-right font-semibold tabular-nums text-testo-principale">
                        {voce.giornateDaFatturare > 0 ? formattaNumeroGiornate(voce.giornateDaFatturare) : "—"}
                      </td>
                      <td className="px-3.5 py-3 text-right font-semibold tabular-nums text-rose-800 dark:text-rose-300">
                        {Number(voce.rimborsiTrasferta) > 0 ? formattaEuro(voce.rimborsiTrasferta) : "—"}
                      </td>
                      {percentuale && (
                        <td className="px-3.5 py-3 text-right font-semibold tabular-nums text-testo-principale">
                          {voce.compenso && Number(voce.compenso) > 0 ? formattaEuro(voce.compenso) : "—"}
                        </td>
                      )}
                      <td className="px-3.5 py-3 text-right align-top whitespace-nowrap">
                        {avanzamento ? (
                          <IndicatoreGiorniErogati avanzamento={avanzamento} />
                        ) : (
                          <span className="font-semibold text-testo-metadati">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                  <td className="px-3.5 py-3 text-xs font-medium text-testo-metadati">Totale</td>
                  <td />
                  <td className="px-3.5 py-3 text-right font-semibold tabular-nums text-testo-principale">{formattaNumeroGiornate(riepilogo.totali.giornateTotali)}</td>
                  <td className="px-3.5 py-3 text-right font-semibold tabular-nums text-testo-principale">{riepilogo.totali.giornateDaFatturare > 0 ? formattaNumeroGiornate(riepilogo.totali.giornateDaFatturare) : "—"}</td>
                  <td className="px-3.5 py-3 text-right font-semibold tabular-nums text-testo-principale">{formattaEuro(riepilogo.totali.totaleRimborsi)}</td>
                  {percentuale && (
                    <td className="px-3.5 py-3 text-right font-semibold tabular-nums text-testo-principale">{formattaEuro(riepilogo.breakdown.imponibileManodopera)}</td>
                  )}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
