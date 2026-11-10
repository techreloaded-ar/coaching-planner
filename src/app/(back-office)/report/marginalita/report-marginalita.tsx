import Link from "next/link";
import type { RisultatoReportMarginalita } from "@/lib/report";
import type { ImportiMarginalita } from "@/domain/consuntivi";
import { formattaEuro, formattaNumeroGiornate } from "@/lib/formattazione";

const formattatorePercentuale = new Intl.NumberFormat("it-IT", {
  style: "percent",
  maximumFractionDigits: 1,
});

export const classeIntestazioneColonna =
  "border-b border-zinc-200 px-5 py-2.5 text-xs font-medium whitespace-nowrap text-testo-metadati dark:border-zinc-700";

const classeCampoMese =
  "h-9 rounded-[10px] border border-zinc-200 bg-white px-3 text-sm text-testo-principale max-sm:h-11 max-sm:w-full dark:border-zinc-700 dark:bg-zinc-800";

/** Margine in euro, in rosso e con badge testuale quando è negativo. */
export function ImportoMargine({ importi }: { importi: ImportiMarginalita }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <span
        className={
          importi.margineNegativo
            ? "font-semibold text-red-600 dark:text-red-400"
            : "font-semibold text-testo-principale"
        }
      >
        {formattaEuro(importi.margine)}
      </span>
      {importi.margineNegativo && (
        <span className="rounded-full bg-red-50 px-2 py-[2px] text-xs font-medium whitespace-nowrap text-red-600 dark:bg-red-500/15 dark:text-red-300">
          Margine negativo
        </span>
      )}
    </span>
  );
}

export function percentuale(importi: ImportiMarginalita): string {
  return importi.marginePercentuale === null
    ? "—"
    : formattatorePercentuale.format(importi.marginePercentuale);
}

export function Cifra({
  etichetta,
  children,
}: {
  etichetta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-right leading-[1.15]">
      <span className="mb-[3px] block text-xs font-medium text-testo-metadati">
        {etichetta}
      </span>
      <span className="text-[17px] tabular-nums text-testo-principale">
        {children}
      </span>
    </div>
  );
}

interface ReportMarginalitaProps {
  da: string;
  a: string;
  etichettaPeriodo: string;
  report: RisultatoReportMarginalita;
}

export default function ReportMarginalita({
  da,
  a,
  etichettaPeriodo,
  report,
}: ReportMarginalitaProps) {
  const vuoto =
    report.perCliente.length === 0 && Number(report.fissiNonAttribuibili) === 0;
  return (
    <div className="flex flex-col gap-4">
      {/* Selettore periodo: form GET con input month nativi */}
      <form
        method="get"
        action="/report/marginalita"
        className="mb-2 flex flex-wrap items-end gap-3 max-sm:grid max-sm:grid-cols-2 max-sm:gap-2"
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="marginalita-da"
            className="text-xs font-medium text-testo-metadati"
          >
            Dal mese
          </label>
          <input
            id="marginalita-da"
            type="month"
            name="da"
            defaultValue={da}
            required
            className={classeCampoMese}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="marginalita-a"
            className="text-xs font-medium text-testo-metadati"
          >
            Al mese
          </label>
          <input
            id="marginalita-a"
            type="month"
            name="a"
            defaultValue={a}
            required
            className={classeCampoMese}
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-[10px] bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 max-sm:col-span-2 max-sm:h-11"
        >
          Applica
        </button>
      </form>

      {vuoto ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-5 py-10 text-center text-sm text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800">
          Nessuna attività fatturabile o non fatturabile nel periodo selezionato.
        </div>
      ) : (
        <>
          {/* ── Sintesi del periodo: ricavi − costi = margine ── */}
          <section
            data-testid="marginalita-totali"
            aria-label={`Sintesi ${etichettaPeriodo}`}
            className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-zinc-200 bg-white px-6 py-5 tabular-nums max-sm:flex-col max-sm:items-stretch max-sm:gap-1 max-sm:px-4 max-sm:py-4 dark:border-zinc-700 dark:bg-zinc-800"
          >
            <VoceSintesi etichetta="Ricavi totali">
              {formattaEuro(report.totali.ricavi)}
            </VoceSintesi>
            <span aria-hidden="true" className="pb-0.5 text-lg text-zinc-400 max-sm:hidden dark:text-zinc-500">
              −
            </span>
            <VoceSintesi etichetta="Costi totali">
              {formattaEuro(report.totali.costi)}
            </VoceSintesi>
            <span aria-hidden="true" className="pb-0.5 text-lg text-zinc-400 max-sm:hidden dark:text-zinc-500">
              =
            </span>
            <div className="max-sm:order-first max-sm:mb-2">
              <span className="block text-xs font-medium text-testo-metadati">
                Margine totale · {etichettaPeriodo}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  className={`text-[32px] leading-tight font-semibold max-sm:text-[28px] ${
                    report.totali.margineNegativo
                      ? "text-red-600 dark:text-red-400"
                      : "text-testo-principale"
                  }`}
                >
                  {formattaEuro(report.totali.margine)}
                </span>
                {report.totali.margineNegativo && (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-sm font-medium whitespace-nowrap text-red-700 dark:bg-red-500/15 dark:text-red-300">
                    Margine negativo
                  </span>
                )}
              </span>
            </div>
          </section>

          <h2 className="mt-4 text-base font-semibold text-testo-principale">
            Dettaglio per cliente e offerta
          </h2>

          {report.perCliente.map((cliente) => (
            <section
              key={cliente.clienteId}
              data-testid={`marginalita-cliente-${cliente.clienteId}`}
              aria-label={cliente.clienteRagioneSociale}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 max-sm:px-4 dark:border-zinc-700">
                <div className="min-w-0 leading-[1.3]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="text-base font-semibold text-testo-principale">
                      <Link
                        href={`/anagrafiche/clienti/${cliente.clienteId}`}
                        className="text-testo-principale no-underline transition-colors hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                      >
                        {cliente.clienteRagioneSociale}
                      </Link>
                    </h3>
                    <Link
                      href={`/report/marginalita/${cliente.clienteId}?da=${da}&a=${a}`}
                      className="rounded-lg border border-zinc-200 bg-white px-2.5 py-0.5 text-sm font-medium whitespace-nowrap text-indigo-600 no-underline transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-indigo-300 dark:hover:bg-zinc-750"
                    >
                      Dettaglio calcolo →
                    </Link>
                  </div>
                  <span className="text-xs tabular-nums text-testo-metadati">
                    {formattaNumeroGiornate(cliente.giornateFatturabili)}{" "}
                    giornate fatturabili
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-6 max-sm:grid max-sm:w-full max-sm:grid-cols-2 max-sm:gap-x-4 max-sm:gap-y-3 max-sm:[&>div]:text-left">
                  <Cifra etichetta="Ricavi">{formattaEuro(cliente.ricavi)}</Cifra>
                  <Cifra etichetta="Costi">{formattaEuro(cliente.costi)}</Cifra>
                  <Cifra etichetta="Margine">
                    <ImportoMargine importi={cliente} />
                  </Cifra>
                  <Cifra etichetta="Margine %">{percentuale(cliente)}</Cifra>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={`${classeIntestazioneColonna} text-left`}>Codice</th>
                      <th className={`${classeIntestazioneColonna} text-left`}>Descrizione</th>
                      <th className={`${classeIntestazioneColonna} text-right`}>Giornate</th>
                      <th className={`${classeIntestazioneColonna} text-right`}>Ricavi</th>
                      <th className={`${classeIntestazioneColonna} text-right`}>Costi</th>
                      <th className={`${classeIntestazioneColonna} text-right`}>Margine</th>
                      <th className={`${classeIntestazioneColonna} text-right`}>Margine %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cliente.perOfferta.map((offerta) => (
                      <tr
                        key={offerta.offertaId ?? "senza-offerta"}
                        data-testid={`marginalita-offerta-${offerta.offertaId ?? "senza-offerta"}`}
                        className={
                          offerta.margineNegativo
                            ? "bg-red-50/60 dark:bg-red-500/10"
                            : "transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        }
                      >
                        <td className={classeCella}>
                          {offerta.offertaId === null ? (
                            <span className={classeCodiceOfferta(null)}>{offerta.offertaCodice}</span>
                          ) : (
                            <Link
                              href={`/anagrafiche/clienti/${cliente.clienteId}`}
                              className={`${classeCodiceOfferta(offerta.offertaId)} no-underline transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-300`}
                            >
                              {offerta.offertaCodice}
                            </Link>
                          )}
                        </td>
                        <td className={`${classeCella} text-sm text-testo-metadati max-sm:min-w-40`}>
                          {offerta.offertaDescrizione}
                        </td>
                        <td className={`${classeCella} text-right whitespace-nowrap text-testo-principale`}>
                          {formattaNumeroGiornate(offerta.giornateFatturabili)}
                        </td>
                        <td className={`${classeCella} text-right whitespace-nowrap text-testo-principale`}>
                          {formattaEuro(offerta.ricavi)}
                        </td>
                        <td className={`${classeCella} text-right whitespace-nowrap text-testo-principale`}>
                          {formattaEuro(offerta.costi)}
                          {Number(offerta.fissoRipartito) > 0 && (
                            <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
                              di cui fisso ripartito {formattaEuro(offerta.fissoRipartito)}
                            </div>
                          )}
                        </td>
                        <td className={`${classeCella} text-right`}>
                          <ImportoMargine importi={offerta} />
                        </td>
                        <td className={`${classeCella} text-right whitespace-nowrap text-testo-metadati`}>
                          {percentuale(offerta)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {Number(report.fissiNonAttribuibili) > 0 && (
            <div
              data-testid="marginalita-fissi-non-attribuibili"
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 max-sm:px-4 dark:border-amber-500/20 dark:bg-amber-500/10"
            >
              <div className="leading-[1.35]">
                <div className="text-sm font-semibold text-testo-principale">Fissi non attribuibili</div>
                <div className="text-xs text-testo-metadati">
                  Fissi mensili di collaboratori senza ore nel mese: pesano solo sul totale
                </div>
              </div>
              <Cifra etichetta="Costi">{formattaEuro(report.fissiNonAttribuibili)}</Cifra>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Componente della sintesi; su smartphone etichetta e importo stanno su una riga. */
function VoceSintesi({
  etichetta,
  children,
}: {
  etichetta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-sm:flex max-sm:items-baseline max-sm:justify-between">
      <span className="block text-xs font-medium text-testo-metadati max-sm:inline max-sm:text-sm max-sm:font-normal max-sm:text-testo-secondario">
        {etichetta}
      </span>
      <span className="block text-lg text-testo-principale max-sm:inline max-sm:text-sm">
        {children}
      </span>
    </div>
  );
}

const classeCella =
  "border-b border-zinc-100 px-5 py-3 align-middle tabular-nums dark:border-zinc-700/50";

/** Badge del codice offerta: la voce senza offerta è evidenziata come da assegnare. */
export function classeCodiceOfferta(offertaId: string | null): string {
  return offertaId === null
    ? "inline-block w-fit rounded-[6px] border border-amber-200 bg-amber-50 px-2 py-[2px] text-xs font-medium whitespace-nowrap text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
    : "inline-block w-fit rounded-[6px] border border-zinc-200 bg-zinc-50 px-2 py-[2px] text-xs font-medium whitespace-nowrap text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800";
}
