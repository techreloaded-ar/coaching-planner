"use client";

import type { RisultatoReportAvanzamento } from "@/lib/report";
import type {
  VoceAvanzamentoOfferta,
  StatoAvanzamentoOfferta,
} from "@/domain/consuntivi";

// ── Formattatori ────────────────────────────────────────────────

const formattatoreGiornate = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const formattatorePercentuale = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formatta un numero di giornate con al massimo un decimale, stile it-IT. */
function formattaGiornate(valore: number): string {
  return formattatoreGiornate.format(valore);
}

/** Iniziali del nome del collaboratore per l'avatar della tabella dettaglio. */
function inizialiCollaboratore(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parola) => parola[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Configurazione visiva per stato di avanzamento ───────────────

interface ConfigStato {
  etichetta: string;
  stripe: string;
  badgeClassi: string;
  logoClassi: string;
  barraClassi: string;
  residuoClassi: string;
  pctClassi: string;
  icona: React.ReactNode;
}

const CONFIG_STATO: Record<StatoAvanzamentoOfferta, ConfigStato> = {
  IN_CORSO: {
    etichetta: "In corso",
    stripe: "before:bg-indigo-500",
    badgeClassi:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300",
    logoClassi:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
    barraClassi: "bg-gradient-to-r from-indigo-500 to-indigo-700",
    residuoClassi:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    pctClassi: "text-indigo-600 dark:text-indigo-400",
    icona: (
      <path d="M20 6 9 17l-5-5" />
    ),
  },
  IN_ALLERTA: {
    etichetta: "In allerta",
    stripe: "before:bg-amber-500",
    badgeClassi:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
    logoClassi:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
    barraClassi: "bg-gradient-to-r from-amber-400 to-amber-600",
    residuoClassi:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    pctClassi: "text-amber-600 dark:text-amber-400",
    icona: (
      <>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
  },
  ESAURITA: {
    etichetta: "Esaurita",
    stripe: "before:bg-red-500",
    badgeClassi:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
    logoClassi:
      "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
    barraClassi: "bg-gradient-to-r from-red-500 to-red-700",
    residuoClassi:
      "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    pctClassi: "text-red-600 dark:text-red-400",
    icona: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </>
    ),
  },
  OLTRE_BUDGET: {
    etichetta: "Oltre budget",
    stripe: "before:bg-red-500",
    badgeClassi:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
    logoClassi:
      "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
    barraClassi:
      "bg-[repeating-linear-gradient(45deg,theme(colors.red.500)_0_8px,theme(colors.red.700)_8px_16px)]",
    residuoClassi:
      "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    pctClassi: "text-red-600 dark:text-red-400",
    icona: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </>
    ),
  },
};

// ── Props ───────────────────────────────────────────────────────

interface ReportAvanzamentoOfferteProps {
  report: RisultatoReportAvanzamento;
}

// ── Componente ──────────────────────────────────────────────────

export default function ReportAvanzamentoOfferte({
  report,
}: ReportAvanzamentoOfferteProps) {
  const offerte = report.perOfferta;
  const vuoto = offerte.length === 0;

  const numeroCritiche = offerte.filter(
    (offerta) => offerta.stato === "ESAURITA" || offerta.stato === "OLTRE_BUDGET",
  ).length;

  return (
    <div>
      {/* ── Pill di riepilogo cumulativo ── */}
      {!vuoto && (
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex-1" />
          <div
            className={`inline-flex items-center gap-[9px] rounded-full border px-[14px] py-1.5 text-[12.5px] font-semibold ${
              numeroCritiche > 0
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                : "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-[15px] w-[15px]"
            >
              <path d="m21 16-9 5-9-5V8l9-5 9 5v8Z" />
              <path d="m3.3 7 8.7 5 8.7-5M12 12v9" />
            </svg>
            <span>
              <b className="tabular-nums">{offerte.length}</b>{" "}
              {offerte.length === 1 ? "offerta" : "offerte"}
            </span>
            {numeroCritiche > 0 && (
              <>
                <span className="h-[13px] w-px bg-red-200 dark:bg-red-500/40" />
                <span>
                  <b className="tabular-nums">{numeroCritiche}</b> da
                  presidiare
                </span>
              </>
            )}
          </div>
        </div>
      )}

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
              <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />
            </svg>
          </div>
          <h3 className="mb-[7px] text-[16px] font-bold text-zinc-800 dark:text-zinc-100">
            Nessuna offerta da monitorare
          </h3>
          <p className="mx-auto max-w-[420px] text-[13px] leading-relaxed text-zinc-400 dark:text-zinc-500">
            Non risultano offerte con attività registrate dai collaboratori.
            Appena verranno consuntivate le prime giornate, qui comparirà
            l&apos;avanzamento di ogni offerta con previste, erogate e
            residuo.
          </p>
        </div>
      ) : (
        <>
          {/* ── Elenco schede per offerta, ordinate per criticità ── */}
          <div className="flex flex-col gap-[18px]">
            {offerte.map((offerta) => (
              <SchedaOfferta key={offerta.offertaId} offerta={offerta} />
            ))}
          </div>

          {/* ── Scheda riepilogo cumulativo del portafoglio ── */}
          <div className="relative mt-[22px] overflow-hidden rounded-[11px] border border-indigo-700 bg-gradient-to-br from-indigo-500 to-indigo-700 px-6 py-[22px] text-white shadow-lg">
            <div className="mb-4 flex items-center gap-[9px] text-[11.5px] font-bold uppercase tracking-[0.06em] text-white/80">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                className="h-4 w-4"
              >
                <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />
              </svg>
              Riepilogo del portafoglio offerte
            </div>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="flex flex-wrap items-stretch">
                <div className="mr-[26px] border-r border-white/20 pr-[26px]">
                  <div className="mb-[5px] text-[11.5px] font-semibold text-white/80">
                    Giornate previste
                  </div>
                  <div className="text-[19px] font-bold -tracking-[0.02em] tabular-nums">
                    {formattaGiornate(report.totali.giornatePrevisteTotali)} gg
                  </div>
                </div>
                <div>
                  <div className="mb-[5px] text-[11.5px] font-semibold text-white/80">
                    Giornate erogate
                  </div>
                  <div className="text-[19px] font-bold -tracking-[0.02em] tabular-nums">
                    {formattaGiornate(report.totali.giornateErogateTotali)} gg
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="mb-1 text-[11.5px] font-bold uppercase tracking-[0.05em] text-white/80">
                  Residuo complessivo
                </div>
                <div
                  className={`text-[38px] leading-none font-extrabold -tracking-[0.04em] tabular-nums ${
                    report.totali.residuoTotale < 0 ? "text-red-200" : ""
                  }`}
                >
                  {formattaGiornate(report.totali.residuoTotale)} gg
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Sottocomponenti ───────────────────────────────────────────────

function SchedaOfferta({ offerta }: { offerta: VoceAvanzamentoOfferta }) {
  const config = CONFIG_STATO[offerta.stato];
  const oltreBudget = offerta.residuo < 0;
  const esaurita = offerta.residuo === 0 && offerta.giornatePreviste > 0;
  const percentualeVisibile = Math.min(offerta.percentualeUtilizzo * 100, 100);
  const percentualeReale = Math.round(offerta.percentualeUtilizzo * 100);

  return (
    <div
      className={`relative overflow-hidden rounded-[11px] border bg-white shadow-sm transition before:absolute before:top-0 before:bottom-0 before:left-0 before:w-1 hover:shadow-md dark:bg-zinc-800 ${config.stripe} ${
        oltreBudget || esaurita
          ? "border-red-200 dark:border-red-500/40"
          : offerta.stato === "IN_ALLERTA"
            ? "border-amber-200 dark:border-amber-500/40"
            : "border-zinc-200 dark:border-zinc-700"
      }`}
    >
      {/* Intestazione: codice + descrizione + cliente | badge di stato */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 bg-zinc-50 py-4 pr-5 pl-[22px] dark:border-zinc-700 dark:bg-zinc-800/60">
        <div className="flex min-w-0 items-start gap-[13px]">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${config.logoClassi}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.9}
              className="h-[18px] w-[18px]"
            >
              <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
              <path d="M14 3v6h6M8 13h8M8 17h5" />
            </svg>
          </div>
          <div className="min-w-0 leading-[1.35]">
            <span className="mb-[5px] inline-block w-fit rounded-[6px] border border-zinc-200 bg-white px-2 py-[2px] text-[11px] font-bold whitespace-nowrap text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              {offerta.offertaCodice}
            </span>
            <b className="block text-[16px] font-bold -tracking-[0.01em] text-zinc-800 dark:text-zinc-100">
              {offerta.offertaDescrizione}
            </b>
            <span className="mt-[2px] inline-flex items-center gap-[5px] text-[12.5px] text-zinc-400 dark:text-zinc-500">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-[13px] w-[13px]"
              >
                <path d="M3 21V8.5L9 4l6 4.5V21" />
                <path d="M15 21h6V11l-6-3" />
              </svg>
              {offerta.clienteRagioneSociale}
            </span>
          </div>
        </div>
        <span
          className={`inline-flex flex-none items-center gap-[6px] rounded-full border px-[11px] py-[5px] text-[11.5px] font-bold whitespace-nowrap ${config.badgeClassi}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            className="h-[13px] w-[13px]"
          >
            {config.icona}
          </svg>
          {config.etichetta}
        </span>
      </div>

      {/* Corpo scheda: kpi previste/erogate/residuo + barra di avanzamento */}
      <div className="px-[22px] pt-[18px] pb-5">
        <div className="mb-[18px] grid grid-cols-3 overflow-hidden rounded-[10px] border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
          <div className="border-r border-zinc-200 px-[18px] py-[13px] text-center dark:border-zinc-700">
            <span className="mb-[5px] block text-[10.5px] font-bold tracking-[0.05em] uppercase text-zinc-400 dark:text-zinc-500">
              Previste
            </span>
            <span className="text-[27px] leading-none font-extrabold -tracking-[0.03em] tabular-nums text-zinc-800 dark:text-zinc-100">
              {formattaGiornate(offerta.giornatePreviste)}
              <span className="ml-[3px] text-[12px] font-semibold text-zinc-400 dark:text-zinc-500">
                gg
              </span>
            </span>
          </div>
          <div className="border-r border-zinc-200 px-[18px] py-[13px] text-center dark:border-zinc-700">
            <span className="mb-[5px] block text-[10.5px] font-bold tracking-[0.05em] uppercase text-zinc-400 dark:text-zinc-500">
              Erogate
            </span>
            <span className="text-[27px] leading-none font-extrabold -tracking-[0.03em] tabular-nums text-zinc-800 dark:text-zinc-100">
              {formattaGiornate(offerta.giornateErogate)}
              <span className="ml-[3px] text-[12px] font-semibold text-zinc-400 dark:text-zinc-500">
                gg
              </span>
            </span>
          </div>
          <div className={`px-[18px] py-[13px] text-center ${config.residuoClassi}`}>
            <span className="mb-[5px] block text-[10.5px] font-bold tracking-[0.05em] uppercase opacity-90">
              Residuo
            </span>
            <span className="text-[27px] leading-none font-extrabold -tracking-[0.03em] tabular-nums">
              {formattaGiornate(offerta.residuo)}
              <span className="ml-[3px] text-[12px] font-semibold opacity-80">
                gg
              </span>
            </span>
            <span className="mt-1 block text-[11px] tabular-nums opacity-80">
              {oltreBudget
                ? "oltre il previsto"
                : esaurita
                  ? "nessun giorno"
                  : "ancora disponibili"}
            </span>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
              Avanzamento erogato sul previsto
            </span>
            <span className={`text-[15px] font-extrabold -tracking-[0.02em] tabular-nums ${config.pctClassi}`}>
              {percentualeReale}%
            </span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-700/50">
            <div
              className={`absolute top-0 bottom-0 left-0 rounded-full transition-[width] duration-500 ${config.barraClassi}`}
              style={{ width: `${percentualeVisibile}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-[10px] text-[11.5px] tabular-nums text-zinc-400 dark:text-zinc-500">
            <span>
              {formattaGiornate(offerta.giornateErogate)} di{" "}
              {formattaGiornate(offerta.giornatePreviste)} gg erogate
            </span>
            {oltreBudget && (
              <span className="inline-flex items-center gap-[5px] font-bold text-red-600 dark:text-red-400">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  className="h-[13px] w-[13px]"
                >
                  <path d="M12 5v14M5 12l7-7 7 7" />
                </svg>
                {formattaGiornate(Math.abs(offerta.residuo))} gg oltre il
                previsto
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabella dettaglio per collaboratore */}
      <div className="border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2 px-[22px] pt-3 text-[10.5px] font-bold tracking-[0.05em] uppercase text-zinc-400 dark:text-zinc-500">
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
          Giornate erogate per collaboratore
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr>
                <th className="px-[22px] py-2 text-left text-[10.5px] font-bold whitespace-nowrap text-zinc-400 dark:text-zinc-500">
                  Collaboratore
                </th>
                <th className="px-[22px] py-2 text-right text-[10.5px] font-bold whitespace-nowrap text-zinc-400 dark:text-zinc-500">
                  Ore consuntivate
                </th>
                <th className="px-[22px] py-2 text-right text-[10.5px] font-bold whitespace-nowrap text-zinc-400 dark:text-zinc-500">
                  Giornate erogate
                </th>
                <th className="px-[22px] py-2 text-right text-[10.5px] font-bold whitespace-nowrap text-zinc-400 dark:text-zinc-500">
                  Quota
                </th>
              </tr>
            </thead>
            <tbody>
              {offerta.perCollaboratore.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="border-t border-zinc-100 px-[22px] py-3 text-[13px] text-zinc-400 italic dark:border-zinc-700/50 dark:text-zinc-500"
                  >
                    Nessuna attività registrata per questa offerta
                  </td>
                </tr>
              ) : (
                offerta.perCollaboratore.map((collaboratore) => {
                  const quota =
                    offerta.giornateErogate > 0
                      ? (collaboratore.giornateErogate /
                          offerta.giornateErogate) *
                        100
                      : 0;
                  return (
                    <tr
                      key={collaboratore.collaboratoreId}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="border-t border-zinc-100 px-[22px] py-[11px] align-middle dark:border-zinc-700/50">
                        <div className="flex min-w-0 items-center gap-[10px]">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-[11px] font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-300">
                            {inizialiCollaboratore(
                              collaboratore.collaboratoreNome,
                            )}
                          </span>
                          <span className="truncate text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-100">
                            {collaboratore.collaboratoreNome}
                          </span>
                        </div>
                      </td>
                      <td className="border-t border-zinc-100 px-[22px] py-[11px] text-right align-middle tabular-nums whitespace-nowrap text-zinc-500 dark:border-zinc-700/50 dark:text-zinc-400">
                        {formattaGiornate(collaboratore.oreErogate)} h
                      </td>
                      <td className="border-t border-zinc-100 px-[22px] py-[11px] text-right align-middle font-bold tabular-nums whitespace-nowrap text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                        {formattaGiornate(collaboratore.giornateErogate)} gg
                      </td>
                      <td className="border-t border-zinc-100 px-[22px] py-[11px] text-right align-middle text-[12.5px] tabular-nums whitespace-nowrap text-zinc-400 dark:border-zinc-700/50 dark:text-zinc-500">
                        {formattatorePercentuale.format(quota)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
