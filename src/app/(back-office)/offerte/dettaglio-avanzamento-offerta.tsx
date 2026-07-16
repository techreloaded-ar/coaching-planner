"use client";

import type { ReactNode } from "react";
import type { StatoAvanzamentoOfferta } from "@/domain/consuntivi";
import type { VoceElencoOfferta } from "@/lib/offerte";

const formattatoreGiornate = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const formattatorePercentuale = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formattaGiornate(valore: number): string {
  return formattatoreGiornate.format(valore);
}

function inizialiCollaboratore(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parola) => parola[0]?.toUpperCase() ?? "")
    .join("");
}

interface ConfigStato {
  etichetta: string;
  stripe: string;
  badgeClassi: string;
  barraClassi: string;
  residuoClassi: string;
  percentualeClassi: string;
  icona: ReactNode;
}

const CONFIG_STATO: Record<StatoAvanzamentoOfferta, ConfigStato> = {
  IN_CORSO: {
    etichetta: "In corso",
    stripe: "before:bg-indigo-500",
    badgeClassi:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300",
    barraClassi: "bg-gradient-to-r from-indigo-500 to-indigo-700",
    residuoClassi:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    percentualeClassi: "text-indigo-600 dark:text-indigo-400",
    icona: <path d="M20 6 9 17l-5-5" />,
  },
  IN_ALLERTA: {
    etichetta: "In allerta",
    stripe: "before:bg-amber-500",
    badgeClassi:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
    barraClassi: "bg-gradient-to-r from-amber-400 to-amber-600",
    residuoClassi:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    percentualeClassi: "text-amber-600 dark:text-amber-400",
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
    barraClassi: "bg-gradient-to-r from-red-500 to-red-700",
    residuoClassi:
      "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    percentualeClassi: "text-red-600 dark:text-red-400",
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
    barraClassi:
      "bg-[repeating-linear-gradient(45deg,theme(colors.red.500)_0_8px,theme(colors.red.700)_8px_16px)]",
    residuoClassi:
      "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    percentualeClassi: "text-red-600 dark:text-red-400",
    icona: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </>
    ),
  },
};

interface DettaglioAvanzamentoOffertaProps {
  offerta: VoceElencoOfferta;
}

export default function DettaglioAvanzamentoOfferta({
  offerta,
}: DettaglioAvanzamentoOffertaProps) {
  const config = CONFIG_STATO[offerta.stato];
  const oltreBudget = offerta.residuo < 0;
  const esaurita = offerta.residuo === 0 && offerta.giorniPrevisti > 0;
  const percentualeReale = Math.round(offerta.percentualeUtilizzo * 100);
  const percentualeVisibile = Math.min(offerta.percentualeUtilizzo * 100, 100);

  return (
    <section
      role="region"
      aria-label={`Dettaglio avanzamento ${offerta.codice}`}
      className={`relative m-4 overflow-hidden rounded-[11px] border bg-white shadow-sm before:absolute before:top-0 before:bottom-0 before:left-0 before:w-1 dark:bg-zinc-900 ${config.stripe} ${
        oltreBudget || esaurita
          ? "border-red-200 dark:border-red-500/40"
          : offerta.stato === "IN_ALLERTA"
            ? "border-amber-200 dark:border-amber-500/40"
            : "border-zinc-200 dark:border-zinc-700"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 py-[13px] pr-[18px] pl-[22px] dark:border-zinc-700 dark:bg-zinc-800/60">
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[14px] w-[14px] text-indigo-600 dark:text-indigo-400">
            <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />
          </svg>
          Dettaglio avanzamento
        </span>
        <span className={`inline-flex items-center gap-[6px] rounded-full border px-[11px] py-[5px] text-[11.5px] font-bold whitespace-nowrap ${config.badgeClassi}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[13px] w-[13px]">
            {config.icona}
          </svg>
          {config.etichetta}
        </span>
      </div>

      <div className="px-[22px] pt-4 pb-[18px]">
        <div className="mb-4 grid grid-cols-3 overflow-hidden rounded-[10px] border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
          <Kpi etichetta="Previste" valore={offerta.giorniPrevisti} />
          <Kpi etichetta="Erogate" valore={offerta.giornateErogate} />
          <div className={`px-4 py-3 text-center ${config.residuoClassi}`}>
            <span className="mb-[5px] block text-[10px] font-bold uppercase tracking-[.05em] opacity-90">Residuo</span>
            <span className="text-[25px] leading-none font-extrabold tracking-[-.02em] tabular-nums">
              {formattaGiornate(offerta.residuo)}
              <span className="ml-[3px] text-[11px] font-semibold opacity-80">gg</span>
            </span>
            <span className="mt-[5px] block text-[10.5px] tabular-nums opacity-80">
              {oltreBudget
                ? "oltre il previsto"
                : esaurita
                  ? "nessun giorno"
                  : "ancora disponibili"}
            </span>
          </div>
        </div>

        <div>
          <div className="mb-[7px] flex items-baseline justify-between gap-3">
            <span className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">Avanzamento erogato sul previsto</span>
            <span className={`text-[15px] font-extrabold tracking-[-.02em] tabular-nums ${config.percentualeClassi}`}>
              {percentualeReale}%
            </span>
          </div>
          <div className="relative h-[11px] overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-700/50">
            <div
              data-testid="barra-avanzamento-offerta"
              className={`absolute top-0 bottom-0 left-0 rounded-full transition-[width] duration-500 ${config.barraClassi}`}
              style={{ width: `${percentualeVisibile}%` }}
            />
          </div>
          <div className="mt-[7px] flex items-center justify-between gap-[10px] text-[11.5px] tabular-nums text-zinc-400 dark:text-zinc-500">
            <span>
              {formattaGiornate(offerta.giornateErogate)} di {formattaGiornate(offerta.giorniPrevisti)} gg erogate
            </span>
            {oltreBudget && (
              <span className="inline-flex items-center gap-[5px] font-bold text-red-600 dark:text-red-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[13px] w-[13px]">
                  <path d="M12 5v14M5 12l7-7 7 7" />
                </svg>
                {formattaGiornate(Math.abs(offerta.residuo))} gg oltre il previsto
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2 px-[22px] pt-3 text-[10.5px] font-bold uppercase tracking-[.05em] text-zinc-400 dark:text-zinc-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[14px] w-[14px]">
            <circle cx="9" cy="8" r="3.2" />
            <path d="M2.8 19a6.2 6.2 0 0 1 12.4 0" />
            <circle cx="17.2" cy="9.2" r="2.4" />
            <path d="M15.5 14.3a5 5 0 0 1 5.7 4.7" />
          </svg>
          Giornate erogate per collaboratore
        </div>
        {offerta.perCollaboratore.length === 0 ? (
          <p className="px-[22px] py-4 text-[13px] italic text-zinc-400 dark:text-zinc-500">
            Nessuna attività registrata per questa offerta
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]" aria-label="Giornate erogate per collaboratore">
              <thead>
                <tr>
                  <th className="px-[22px] py-2 text-left text-[10px] font-bold tracking-[.04em] text-zinc-400 dark:text-zinc-500">Collaboratore</th>
                  <th className="px-[22px] py-2 text-right text-[10px] font-bold tracking-[.04em] whitespace-nowrap text-zinc-400 dark:text-zinc-500">Ore consuntivate</th>
                  <th className="px-[22px] py-2 text-right text-[10px] font-bold tracking-[.04em] whitespace-nowrap text-zinc-400 dark:text-zinc-500">Giornate erogate</th>
                  <th className="px-[22px] py-2 text-right text-[10px] font-bold tracking-[.04em] whitespace-nowrap text-zinc-400 dark:text-zinc-500">Quota</th>
                </tr>
              </thead>
              <tbody>
                {offerta.perCollaboratore.map((collaboratore) => {
                  const quota = offerta.giornateErogate > 0
                    ? (collaboratore.giornateErogate / offerta.giornateErogate) * 100
                    : 0;

                  return (
                    <tr key={collaboratore.collaboratoreId} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="border-t border-zinc-100 px-[22px] py-[9px] align-middle dark:border-zinc-700/50">
                        <div className="flex min-w-0 items-center gap-[10px]">
                          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-[10px] font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-300">
                            {inizialiCollaboratore(collaboratore.collaboratoreNome)}
                          </span>
                          <span className="truncate text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">{collaboratore.collaboratoreNome}</span>
                        </div>
                      </td>
                      <td className="border-t border-zinc-100 px-[22px] py-[9px] text-right align-middle tabular-nums whitespace-nowrap text-zinc-500 dark:border-zinc-700/50 dark:text-zinc-400">
                        {formattaGiornate(collaboratore.oreErogate)} h
                      </td>
                      <td className="border-t border-zinc-100 px-[22px] py-[9px] text-right align-middle font-bold tabular-nums whitespace-nowrap text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                        {formattaGiornate(collaboratore.giornateErogate)} gg
                      </td>
                      <td className="border-t border-zinc-100 px-[22px] py-[9px] text-right align-middle text-[12.5px] tabular-nums whitespace-nowrap text-zinc-400 dark:border-zinc-700/50 dark:text-zinc-500">
                        {formattatorePercentuale.format(quota)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Kpi({ etichetta, valore }: { etichetta: string; valore: number }) {
  return (
    <div className="border-r border-zinc-200 px-4 py-3 text-center dark:border-zinc-700">
      <span className="mb-[5px] block text-[10px] font-bold uppercase tracking-[.05em] text-zinc-400 dark:text-zinc-500">{etichetta}</span>
      <span className="text-[25px] leading-none font-extrabold tracking-[-.02em] tabular-nums text-zinc-800 dark:text-zinc-100">
        {formattaGiornate(valore)}
        <span className="ml-[3px] text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">gg</span>
      </span>
    </div>
  );
}
