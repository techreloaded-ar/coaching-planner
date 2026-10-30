"use client";

import Link from "next/link";
import { urlDelFoglio } from "@/lib/url-foglio-attivita";
import { useCollaboratoreConsultato } from "../attivita-cache-provider";
import type { RisultatoRiepilogoMese } from "@/lib/attivita";
import type { VoceRiepilogoOfferta } from "@/domain/consuntivi";
import { ETICHETTA_MODALITA_TARIFFA, etichettaMeseTariffa } from "@/domain/tariffe";
import {
  CATEGORIE_ATTIVITA,
  DESCRIZIONE_CATEGORIA_ATTIVITA,
  ETICHETTA_OFFERTA_DA_DEFINIRE,
} from "@/domain/types";

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

function formattaGiornate(valore: number): string {
  return valore.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
        `${DESCRIZIONE_CATEGORIA_ATTIVITA[categoria].etichetta} ${formattaNumero(voce.orePerCategoria[categoria])} h`,
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
  const collaboratoreConsultatoId = useCollaboratoreConsultato();

  return (
    <div className="mx-auto w-full max-w-[1080px] px-8 py-7 max-md:px-4 max-md:py-5">
      <div className="mb-5">
        <Link
          href={urlDelFoglio(`/attivita?mese=${token}`, collaboratoreConsultatoId)}
          className="inline-flex items-center gap-[7px] text-[13px] font-semibold text-zinc-500 transition hover:text-rose-800 dark:text-zinc-400 dark:hover:text-rose-300"
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
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            aria-label="Mese precedente"
            title="Mese precedente"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[18px] w-[18px]">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </Link>

          <div className="min-w-[188px] text-center text-[19px] font-bold capitalize -tracking-[0.02em] text-zinc-800 dark:text-zinc-100">
            {etichetta}
          </div>

          <Link
            href={urlDelFoglio(`/attivita/riepilogo?mese=${tokenSuccessivo}`, collaboratoreConsultatoId)}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            aria-label="Mese successivo"
            title="Mese successivo"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[18px] w-[18px]">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>

          <Link
            href={urlDelFoglio("/attivita/riepilogo", collaboratoreConsultatoId)}
            className="ml-1 inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l2.5 1.5" />
            </svg>
            Mese corrente
          </Link>
        </div>

        <div className="flex-1" />

        <div className="inline-flex items-center gap-[9px] rounded-full border border-rose-200 bg-rose-50 px-[13px] py-1.5 text-[12.5px] font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[15px] w-[15px]">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
          <b className="tabular-nums">
            {riepilogo.perOfferta.filter((voce) => voce.offertaId !== null).length} offerte
          </b>
          <span className="block h-[13px] w-px bg-rose-200 dark:bg-rose-800" />
          <b className="tabular-nums">{formattaGiornate(riepilogo.totali.giornateTotali)} g</b>
        </div>
      </div>

      <div className="mb-1">
        <div className="inline-flex items-center gap-[7px] text-[12.5px] font-bold uppercase tracking-[0.04em] text-rose-800 dark:text-rose-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[15px] w-[15px]">
            <rect x="3" y="4" width="18" height="17" rx="2.5" />
            <path d="M3 9h18M8 2v4M16 2v4" />
          </svg>
          Riepilogo mensile
        </div>
        <h2 className="mt-1.5 text-[27px] font-bold capitalize tracking-tight text-zinc-800 dark:text-zinc-100 max-md:text-[23px]">
          {etichetta}
        </h2>
      </div>

      <div className="mt-[18px] grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div data-testid="summary-ore-totali" className="rounded-[11px] border border-zinc-200 bg-white p-[16px_18px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Ore totali</div>
          <div data-testid="summary-ore-totali-value" className="mt-1 text-[28px] font-bold tabular-nums tracking-tight text-zinc-800 dark:text-zinc-100">
            {formattaNumero(riepilogo.totali.oreTotali)}
          </div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500">{formattaGiornate(riepilogo.totali.giornateTotali)} giornate</div>
        </div>

        <div className="rounded-[11px] border border-zinc-200 bg-white p-[16px_18px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Giornate totali</div>
          <div className="mt-1 text-[28px] font-bold tabular-nums tracking-tight text-zinc-800 dark:text-zinc-100">
            {formattaGiornate(riepilogo.totali.giornateTotali)}
          </div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500">1 giornata = 8 ore</div>
        </div>

        <div data-testid="summary-ore-da-fatturare" className="rounded-[11px] border border-zinc-200 bg-white p-[16px_18px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Ore da fatturare</div>
          <div data-testid="summary-ore-da-fatturare-value" className="mt-1 text-[28px] font-bold tabular-nums tracking-tight text-zinc-800 dark:text-zinc-100">
            {formattaNumero(riepilogo.totali.oreDaFatturare)}
          </div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500">Fatturabili e non fatturabili, da fatturare ad Agile Reloaded</div>
        </div>

        <div data-testid="summary-giornate-da-fatturare" className="rounded-[11px] border border-zinc-200 bg-white p-[16px_18px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Giornate da fatturare</div>
          <div className="mt-1 text-[28px] font-bold tabular-nums tracking-tight text-zinc-800 dark:text-zinc-100">
            {formattaGiornate(riepilogo.totali.giornateDaFatturare)}
          </div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500">
            {riepilogo.breakdown.modalitaTariffa === "GIORNALIERA"
              ? `Tariffa giorno: ${formattaEuro(riepilogo.breakdown.importoTariffa)}`
              : riepilogo.breakdown.modalitaTariffa === "FISSO_MENSILE"
                ? "Il fisso mensile non dipende dalle giornate"
                : "Nessuna tariffa in vigore"}
          </div>
        </div>

        <div data-testid="summary-ore-per-categoria" className="rounded-[11px] border border-zinc-200 bg-white p-[16px_18px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Ore per categoria</div>
          <dl className="mt-2 space-y-1 text-[13px]">
            {CATEGORIE_ATTIVITA.map((categoria) => (
              <div key={categoria} className="flex justify-between gap-3">
                <dt className="text-zinc-500 dark:text-zinc-400">{DESCRIZIONE_CATEGORIA_ATTIVITA[categoria].etichetta}</dt>
                <dd className="font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{formattaNumero(riepilogo.totali.orePerCategoria[categoria])} h</dd>
              </div>
            ))}
          </dl>
        </div>

        <div data-testid="summary-rimborsi" className="rounded-[11px] border border-zinc-200 bg-white p-[16px_18px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Totale rimborsi trasferta</div>
          <div data-testid="summary-rimborsi-value" className="mt-1 text-[28px] font-bold tabular-nums tracking-tight text-zinc-800 dark:text-zinc-100">
            {formattaEuro(riepilogo.totali.totaleRimborsi)}
          </div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500">Somma delle trasferte del mese</div>
        </div>

        <div data-testid="summary-importo-fattura" className="overflow-hidden rounded-[11px] border border-rose-600 bg-gradient-to-br from-rose-600 to-rose-700 p-[18px_20px] text-white shadow-[0_12px_40px_rgba(24,24,27,0.16)] md:col-span-2 xl:col-span-3 dark:from-rose-500 dark:to-rose-600">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-white/80">Importo fattura</div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div data-testid="summary-importo-fattura-value" className="text-[38px] font-bold tabular-nums tracking-tight">{formattaEuro(riepilogo.importoFattura)}</div>
            <div data-testid="summary-importo-fattura-breakdown" className="flex flex-wrap items-center gap-3 text-[12.5px] font-semibold text-white/85">
              {riepilogo.breakdown.modalitaTariffa === "FISSO_MENSILE" ? (
                <span>Fisso mensile {formattaEuro(riepilogo.breakdown.importoTariffa)}</span>
              ) : (
                <>
                  <span>{riepilogo.breakdown.giornateDaFatturare} g × {formattaEuro(riepilogo.breakdown.importoTariffa)}</span>
                  <span className="h-4 w-px bg-white/25" />
                  <span>Compenso {formattaEuro(riepilogo.breakdown.imponibileManodopera)}</span>
                </>
              )}
              <span className="h-4 w-px bg-white/25" />
              <span>Rimborsi {formattaEuro(riepilogo.breakdown.totaleRimborsi)}</span>
            </div>
          </div>
          <div data-testid="summary-importo-fattura-tariffa" className="mt-2 text-[12px] text-white/80">
            {riepilogo.breakdown.modalitaTariffa && riepilogo.breakdown.tariffaValidaDalMese
              ? `Tariffa ${ETICHETTA_MODALITA_TARIFFA[riepilogo.breakdown.modalitaTariffa].toLowerCase()} valida da ${etichettaMeseTariffa(riepilogo.breakdown.tariffaValidaDalMese)}`
              : "Nessuna tariffa in vigore in questo mese"}
            {riepilogo.breakdown.modalitaTariffa === "FISSO_MENSILE" &&
              ` · ${riepilogo.breakdown.giornateDaFatturare} g registrate: il fisso non dipende dalle giornate`}
          </div>
        </div>
      </div>

      <section className="mt-[30px]">
        <div className="mb-[13px] flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-zinc-800 dark:text-zinc-100">Dettaglio per offerta</h3>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-[9px] py-[2px] text-[11.5px] font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
            {riepilogo.perOfferta.length}
          </span>
        </div>

        {!haDati ? (
          <div className="rounded-[11px] border border-dashed border-zinc-200 bg-zinc-50 p-[32px_20px] text-center text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-2.5 h-8 w-8 opacity-40">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Nessuna attività registrata per questo mese.
          </div>
        ) : (
          <div data-testid="summary-table" className="overflow-x-auto rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <table className="min-w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                  <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Cliente</th>
                  <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Offerta</th>
                  <th className="px-3.5 py-3 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Ore totali</th>
                  <th className="px-3.5 py-3 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Giornate totali</th>
                  <th className="px-3.5 py-3 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Ore da fatturare</th>
                  <th className="px-3.5 py-3 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Giornate da fatturare</th>
                  <th className="px-3.5 py-3 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Rimborsi trasferta</th>
                </tr>
              </thead>
              <tbody>
                {riepilogo.perOfferta.map((voce) => {
                  const badge = badgeCategorieNonFatturabili(voce);

                  return (
                    <tr
                      key={voce.offertaId ?? `senza-offerta|${voce.clienteId}`}
                      className="border-b border-zinc-100 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                    >
                      <td className="px-3.5 py-3 align-top text-[13.5px] font-bold text-zinc-800 dark:text-zinc-100">
                        {voce.clienteRagioneSociale}
                      </td>
                      <td className="px-3.5 py-3 align-top">
                        <div className="flex min-w-0 flex-col gap-1">
                          {voce.offertaId === null ? (
                            <span
                              data-testid="riepilogo-offerta-da-definire"
                              className="w-fit rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            >
                              {ETICHETTA_OFFERTA_DA_DEFINIRE}
                            </span>
                          ) : (
                            <>
                              <span className="w-fit rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                                {voce.offertaCodice}
                              </span>
                              <span className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
                                {voce.offertaDescrizione}
                              </span>
                            </>
                          )}
                          {badge.map((testo) => (
                            <span key={testo} className="mt-1 inline-flex w-fit rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10.5px] font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                              {testo}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-right font-bold tabular-nums text-zinc-800 dark:text-zinc-100">
                        {formattaNumero(voce.oreTotali)}
                      </td>
                      <td className="px-3.5 py-3 text-right font-bold tabular-nums text-zinc-800 dark:text-zinc-100">
                        {formattaGiornate(voce.giornateTotali)}
                      </td>
                      <td className="px-3.5 py-3 text-right font-bold tabular-nums text-zinc-800 dark:text-zinc-100">
                        {voce.oreDaFatturare > 0 ? formattaNumero(voce.oreDaFatturare) : "—"}
                      </td>
                      <td className="px-3.5 py-3 text-right font-bold tabular-nums text-zinc-800 dark:text-zinc-100">
                        {voce.giornateDaFatturare > 0 ? formattaGiornate(voce.giornateDaFatturare) : "—"}
                      </td>
                      <td className="px-3.5 py-3 text-right font-bold tabular-nums text-rose-800 dark:text-rose-300">
                        {Number(voce.rimborsiTrasferta) > 0 ? formattaEuro(voce.rimborsiTrasferta) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                  <td className="px-3.5 py-3 text-[12px] font-bold uppercase tracking-[0.04em] text-zinc-400 dark:text-zinc-500">Totale</td>
                  <td />
                  <td className="px-3.5 py-3 text-right font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{formattaNumero(riepilogo.totali.oreTotali)}</td>
                  <td className="px-3.5 py-3 text-right font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{formattaGiornate(riepilogo.totali.giornateTotali)}</td>
                  <td className="px-3.5 py-3 text-right font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{riepilogo.totali.oreDaFatturare > 0 ? formattaNumero(riepilogo.totali.oreDaFatturare) : "—"}</td>
                  <td className="px-3.5 py-3 text-right font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{riepilogo.totali.giornateDaFatturare > 0 ? formattaGiornate(riepilogo.totali.giornateDaFatturare) : "—"}</td>
                  <td className="px-3.5 py-3 text-right font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{formattaEuro(riepilogo.totali.totaleRimborsi)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
