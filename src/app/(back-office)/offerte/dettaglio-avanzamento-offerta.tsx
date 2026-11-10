"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StatoAvanzamentoOfferta } from "@/domain/consuntivi";
import type { VoceElencoOfferta } from "@/lib/offerte";
import {
  CLASSE_RIGA_OFFERTA_NON_ABILITATA,
  IconaOffertaNonAbilitata,
  NoteAnagrafica,
  PulsanteAbilitaOfferta,
} from "@/components";
import { urlFoglioDaAmministrazione } from "@/lib/url-foglio-attivita";
import { formattaNumeroGiornate, formattaOre } from "@/lib/formattazione";

const formattatorePercentuale = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formattatoreMese = new Intl.DateTimeFormat("it-IT", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formattaGiornate(valore: number | null): string {
  return valore === null ? "—" : formattaNumeroGiornate(valore);
}

function etichettaMese(mese: string): string {
  const [anno, numeroMese] = mese.split("-").map(Number);
  return formattatoreMese.format(new Date(Date.UTC(anno, numeroMese - 1, 1)));
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
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    percentualeClassi: "text-amber-700 dark:text-amber-400",
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
  const router = useRouter();
  const config = CONFIG_STATO[offerta.stato];
  const oltreBudget = offerta.stato === "OLTRE_BUDGET";
  const esaurita = offerta.stato === "ESAURITA";
  // Senza giorni previsti non c'è budget: percentuale e residuo restano «—».
  const senzaBudget = offerta.percentualeUtilizzo === null;
  const percentualeReale = Math.round((offerta.percentualeUtilizzo ?? 0) * 100);
  const percentualeVisibile = Math.min((offerta.percentualeUtilizzo ?? 0) * 100, 100);

  // Foglio attività del collaboratore in vista Elenco, filtrato sull'offerta e
  // aperto sull'ultimo mese in cui vi ha segnato ore (i mesi YYYY-MM si
  // ordinano come stringhe).
  const urlFoglioSullOfferta = (collaboratoreId: string) => {
    const riga = offerta.matriceMensile.righe.find((r) => r.collaboratoreId === collaboratoreId);
    const ultimoMese = Object.keys(riga?.giornatePerMese ?? {}).sort().pop();
    return urlFoglioDaAmministrazione(collaboratoreId, {
      offerta: offerta.offertaId,
      ...(ultimoMese ? { mese: ultimoMese } : {}),
    });
  };

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
        <span className="inline-flex items-center gap-2 text-xs font-medium text-testo-metadati">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[14px] w-[14px] text-indigo-600 dark:text-indigo-400">
            <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />
          </svg>
          Dettaglio avanzamento
        </span>
        <span className={`inline-flex items-center gap-[6px] rounded-full border px-[11px] py-[5px] text-xs font-medium whitespace-nowrap ${config.badgeClassi}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[13px] w-[13px]">
            {config.icona}
          </svg>
          {config.etichetta}
        </span>
      </div>

      {(offerta.numeroOrdine || offerta.accountAgileReloaded) && (
        <dl className="m-0 flex flex-wrap gap-x-[28px] gap-y-[10px] border-b border-zinc-200 px-[22px] py-[13px] dark:border-zinc-700">
          <DatoOfferta etichetta="Numero d'ordine" valore={offerta.numeroOrdine} />
          <DatoOfferta etichetta="Account Agile Reloaded" valore={offerta.accountAgileReloaded} />
        </dl>
      )}

      <NoteAnagrafica
        note={offerta.note}
        className="border-b border-zinc-200 px-[22px] py-[13px] dark:border-zinc-700"
      />

      <div className="px-[22px] pt-4 pb-[18px]">
        <div className="mb-4 grid grid-cols-3 overflow-hidden rounded-[10px] border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
          <Kpi etichetta="Previste" valore={offerta.giorniPrevisti} />
          <Kpi etichetta="Erogate" valore={offerta.giornateErogate} />
          <div className={`px-4 py-3 text-center ${config.residuoClassi}`}>
            <span className="mb-[5px] block text-xs font-medium opacity-90">Residuo</span>
            <span className="text-[25px] leading-none font-semibold tracking-[-.02em] tabular-nums">
              {formattaGiornate(offerta.residuo)}
              <span className="ml-[3px] text-xs font-medium opacity-80">gg</span>
            </span>
            <span className="mt-[5px] block text-xs tabular-nums opacity-80">
              {senzaBudget
                ? "giorni previsti non indicati"
                : oltreBudget
                ? "oltre il previsto"
                : esaurita
                  ? "nessun giorno"
                  : "ancora disponibili"}
            </span>
          </div>
        </div>

        <div>
          <div className="mb-[7px] flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium text-testo-metadati">Avanzamento erogato sul previsto</span>
            <span className={`text-[15px] font-semibold tracking-[-.02em] tabular-nums ${config.percentualeClassi}`}>
              {senzaBudget ? "—" : `${percentualeReale}%`}
            </span>
          </div>
          <div className="relative h-[11px] overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-700/50">
            <div
              data-testid="barra-avanzamento-offerta"
              className={`absolute top-0 bottom-0 left-0 rounded-full transition-[width] duration-500 ${config.barraClassi}`}
              style={{ width: `${percentualeVisibile}%` }}
            />
          </div>
          <div className="mt-[7px] flex items-center justify-between gap-[10px] text-xs tabular-nums text-testo-metadati">
            <span>
              {formattaGiornate(offerta.giornateErogate)} di {formattaGiornate(offerta.giorniPrevisti)} gg erogate
            </span>
            {oltreBudget && (
              <span className="inline-flex items-center gap-[5px] font-semibold text-red-600 dark:text-red-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[13px] w-[13px]">
                  <path d="M12 5v14M5 12l7-7 7 7" />
                </svg>
                {formattaGiornate(Math.abs(offerta.residuo ?? 0))} gg oltre il previsto
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2 px-[22px] pt-3 text-xs font-medium text-testo-metadati">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[14px] w-[14px]">
            <circle cx="9" cy="8" r="3.2" />
            <path d="M2.8 19a6.2 6.2 0 0 1 12.4 0" />
            <circle cx="17.2" cy="9.2" r="2.4" />
            <path d="M15.5 14.3a5 5 0 0 1 5.7 4.7" />
          </svg>
          Giornate erogate per collaboratore
        </div>
        {offerta.perCollaboratore.length === 0 ? (
          <p className="px-[22px] py-4 text-sm italic text-testo-metadati">
            Nessuna attività registrata per questa offerta
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" aria-label="Giornate erogate per collaboratore">
              <thead>
                <tr>
                  <th className="px-[22px] py-2 text-left text-xs font-medium text-testo-metadati">Collaboratore</th>
                  <th className="px-[22px] py-2 text-right text-xs font-medium whitespace-nowrap text-testo-metadati">Ore consuntivate</th>
                  <th className="px-[22px] py-2 text-right text-xs font-medium whitespace-nowrap text-testo-metadati">Giornate erogate</th>
                  <th className="px-[22px] py-2 text-right text-xs font-medium whitespace-nowrap text-testo-metadati">Quota</th>
                  <th className="px-[22px] py-2 text-right text-xs font-medium whitespace-nowrap text-testo-metadati">Abilitazione</th>
                </tr>
              </thead>
              <tbody>
                {offerta.perCollaboratore.map((collaboratore) => {
                  const quota = offerta.giornateErogate > 0
                    ? (collaboratore.giornateErogate / offerta.giornateErogate) * 100
                    : 0;
                  const nonAbilitato = offerta.collaboratoriNonAbilitati.find(
                    (voce) => voce.collaboratoreId === collaboratore.collaboratoreId,
                  );

                  return (
                    <tr
                      key={collaboratore.collaboratoreId}
                      data-testid="collaboratore-avanzamento"
                      className={nonAbilitato ? CLASSE_RIGA_OFFERTA_NON_ABILITATA : "transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}
                    >
                      <td className="border-t border-zinc-100 px-[22px] py-[9px] align-middle dark:border-zinc-700/50">
                        <CollaboratoreConFoglio
                          nome={collaboratore.collaboratoreNome}
                          urlFoglio={urlFoglioSullOfferta(collaboratore.collaboratoreId)}
                        />
                      </td>
                      <td className="border-t border-zinc-100 px-[22px] py-[9px] text-right align-middle tabular-nums whitespace-nowrap text-testo-metadati dark:border-zinc-700/50">
                        {formattaOre(collaboratore.oreErogate)}
                      </td>
                      <td className="border-t border-zinc-100 px-[22px] py-[9px] text-right align-middle font-semibold tabular-nums whitespace-nowrap text-testo-principale dark:border-zinc-700/50">
                        {formattaGiornate(collaboratore.giornateErogate)} gg
                      </td>
                      <td className="border-t border-zinc-100 px-[22px] py-[9px] text-right align-middle text-sm tabular-nums whitespace-nowrap text-testo-metadati dark:border-zinc-700/50">
                        {formattatorePercentuale.format(quota)}%
                      </td>
                      <td className="border-t border-zinc-100 px-[22px] py-[9px] text-right align-middle text-xs font-medium dark:border-zinc-700/50">
                        {nonAbilitato ? (
                          <span className="inline-flex flex-wrap items-center justify-end gap-2 text-amber-800 dark:text-amber-300">
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs whitespace-nowrap dark:border-amber-700 dark:bg-amber-900/40">
                              <IconaOffertaNonAbilitata className="h-[11px] w-[11px]" />
                              Non abilitato
                            </span>
                            {offerta.attiva && nonAbilitato.attivo && (
                              <PulsanteAbilitaOfferta
                                collaboratoreId={collaboratore.collaboratoreId}
                                offertaId={offerta.offertaId}
                                nomeCollaboratore={collaboratore.collaboratoreNome}
                                onAbilitata={() => router.refresh()}
                              />
                            )}
                          </span>
                        ) : (
                          <span className="whitespace-nowrap text-emerald-700 dark:text-emerald-400">✓ Abilitato</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2 px-[22px] pt-3 text-xs font-medium text-testo-metadati">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[14px] w-[14px]">
            <rect x="3" y="4.5" width="18" height="16" rx="2" />
            <path d="M3 9h18M8 2.5v4M16 2.5v4" />
          </svg>
          Giornate erogate per mese
        </div>
        {offerta.matriceMensile.mesi.length === 0 ? (
          <p className="px-[22px] py-4 text-sm italic text-testo-metadati">
            Nessuna attività registrata
          </p>
        ) : (
          <div className="overflow-x-auto" data-testid="matrice-mensile-offerta">
            <table className="w-full border-collapse text-sm" aria-label="Giornate erogate per collaboratore e mese">
              <thead>
                <tr>
                  <th className="px-[22px] py-2 text-left text-xs font-medium text-testo-metadati">Collaboratore</th>
                  {offerta.matriceMensile.mesi.map((mese) => (
                    <th key={mese} className="px-[22px] py-2 text-right text-xs font-medium whitespace-nowrap text-testo-metadati">
                      {etichettaMese(mese)}
                    </th>
                  ))}
                  <th className="px-[22px] py-2 text-right text-xs font-medium whitespace-nowrap text-testo-metadati">Totale</th>
                </tr>
              </thead>
              <tbody>
                {offerta.matriceMensile.righe.map((riga) => (
                  <tr key={riga.collaboratoreId} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="border-t border-zinc-100 px-[22px] py-[9px] align-middle dark:border-zinc-700/50">
                      <CollaboratoreConFoglio
                        nome={riga.collaboratoreNome}
                        urlFoglio={urlFoglioSullOfferta(riga.collaboratoreId)}
                      />
                    </td>
                    {offerta.matriceMensile.mesi.map((mese) => (
                      <td key={mese} className="border-t border-zinc-100 px-[22px] py-[9px] text-right align-middle tabular-nums whitespace-nowrap text-testo-metadati dark:border-zinc-700/50">
                        {mese in riga.giornatePerMese ? formattaGiornate(riga.giornatePerMese[mese]) : "—"}
                      </td>
                    ))}
                    <td className="border-t border-zinc-100 px-[22px] py-[9px] text-right align-middle font-semibold tabular-nums whitespace-nowrap text-testo-principale dark:border-zinc-700/50">
                      {formattaGiornate(riga.totaleGiornate)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="border-t border-zinc-200 px-[22px] py-[9px] text-left align-middle text-xs font-medium text-testo-metadati dark:border-zinc-700">
                    Totale mese
                  </td>
                  {offerta.matriceMensile.mesi.map((mese) => (
                    <td key={mese} className="border-t border-zinc-200 px-[22px] py-[9px] text-right align-middle font-semibold tabular-nums whitespace-nowrap text-testo-principale dark:border-zinc-700">
                      {formattaGiornate(offerta.matriceMensile.totaliPerMese[mese])}
                    </td>
                  ))}
                  <td className="border-t border-zinc-200 px-[22px] py-[9px] text-right align-middle font-semibold tabular-nums whitespace-nowrap text-testo-principale dark:border-zinc-700">
                    {formattaGiornate(offerta.matriceMensile.totaleGiornate)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function CollaboratoreConFoglio({ nome, urlFoglio }: { nome: string; urlFoglio: string }) {
  return (
    <div className="flex min-w-0 items-center gap-[10px]">
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-medium text-testo-metadati dark:border-zinc-700 dark:bg-zinc-700/60">
        {inizialiCollaboratore(nome)}
      </span>
      <Link
        href={urlFoglio}
        prefetch={false}
        title={`Apri il foglio attività di ${nome} su questa offerta`}
        className="truncate text-sm font-medium text-testo-principale underline-offset-2 transition-colors hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
      >
        {nome}
      </Link>
    </div>
  );
}

function Kpi({ etichetta, valore }: { etichetta: string; valore: number | null }) {
  return (
    <div className="border-r border-zinc-200 px-4 py-3 text-center dark:border-zinc-700">
      <span className="mb-[5px] block text-xs font-medium text-testo-metadati">{etichetta}</span>
      <span className="text-[25px] leading-none font-semibold tracking-[-.02em] tabular-nums text-testo-principale">
        {formattaGiornate(valore)}
        <span className="ml-[3px] text-xs font-medium text-testo-metadati">gg</span>
      </span>
    </div>
  );
}

function DatoOfferta({ etichetta, valore }: { etichetta: string; valore: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="mb-[3px] text-xs font-medium text-testo-metadati">{etichetta}</dt>
      <dd className={`m-0 break-words text-sm ${valore ? "font-semibold text-testo-principale" : "font-medium text-testo-metadati"}`}>
        {valore || "Non indicato"}
      </dd>
    </div>
  );
}
