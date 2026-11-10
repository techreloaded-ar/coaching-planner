import Link from "next/link";
import type { RisultatoReportMarginalita } from "@/lib/report";
import type { ImportiMarginalita } from "@/domain/consuntivi";
import { formattaEuro, formattaNumeroGiornate, inizialiCliente } from "@/lib/formattazione";

const formattatorePercentuale = new Intl.NumberFormat("it-IT", {
  style: "percent",
  maximumFractionDigits: 1,
});

export const classeIntestazioneColonna =
  "border-b border-zinc-200 bg-white px-5 py-[11px] text-xs font-medium whitespace-nowrap text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800";

const classeCampoMese =
  "rounded-[9px] border border-zinc-200 bg-white px-3 py-[7px] text-sm text-testo-principale dark:border-zinc-700 dark:bg-zinc-800";

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
  return (
    <div className="flex flex-col gap-[18px]">
      {/* Selettore periodo: form GET con input month nativi */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <form
          method="get"
          action="/report/marginalita"
          className="flex flex-wrap items-end gap-3"
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
            className="rounded-[9px] bg-indigo-600 px-4 py-[8px] text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            Applica
          </button>
        </form>
        <p className="text-sm text-testo-metadati">
          Periodo: <b className="text-testo-principale">{etichettaPeriodo}</b>
        </p>
      </div>

      {report.perCliente.length === 0 && Number(report.fissiNonAttribuibili) === 0 ? (
        <div className="rounded-[11px] border border-dashed border-zinc-300 bg-white px-5 py-10 text-center text-sm text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800">
          Nessuna attività fatturabile o non fatturabile nel periodo selezionato.
        </div>
      ) : (
        <>
          {report.perCliente.map((cliente) => (
            <section
              key={cliente.clienteId}
              data-testid={`marginalita-cliente-${cliente.clienteId}`}
              aria-label={cliente.clienteRagioneSociale}
              className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800/60">
                <div className="flex min-w-0 items-center gap-[13px]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-indigo-50 text-sm font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                    {inizialiCliente(cliente.clienteRagioneSociale)}
                  </div>
                  <div className="min-w-0 leading-[1.3]">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="text-[16px] font-semibold -tracking-[0.01em] text-testo-principale">
                        <Link
                          href={`/anagrafiche/clienti/${cliente.clienteId}`}
                          className="text-testo-principale no-underline transition hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                        >
                          {cliente.clienteRagioneSociale}
                        </Link>
                      </h2>
                      <Link
                        href={`/report/marginalita/${cliente.clienteId}?da=${da}&a=${a}`}
                        className="rounded-[8px] border border-indigo-200 bg-white px-[10px] py-[3px] text-sm font-medium whitespace-nowrap text-indigo-600 no-underline transition hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-zinc-800 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                      >
                        Dettaglio calcolo →
                      </Link>
                    </div>
                    <span className="text-xs tabular-nums text-testo-metadati">
                      {formattaNumeroGiornate(cliente.giornateFatturabili)}{" "}
                      giornate fatturabili
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6">
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
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        }
                      >
                        <td className="border-b border-zinc-100 px-5 py-[13px] align-middle dark:border-zinc-700/50">
                          {offerta.offertaId === null ? (
                            <span className={classeCodiceOfferta(null)}>{offerta.offertaCodice}</span>
                          ) : (
                            <Link
                              href={`/anagrafiche/clienti/${cliente.clienteId}`}
                              className={`${classeCodiceOfferta(offerta.offertaId)} no-underline transition hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-300`}
                            >
                              {offerta.offertaCodice}
                            </Link>
                          )}
                        </td>
                        <td className="border-b border-zinc-100 px-5 py-[13px] align-middle text-sm text-testo-metadati dark:border-zinc-700/50">
                          {offerta.offertaDescrizione}
                        </td>
                        <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle tabular-nums whitespace-nowrap text-testo-principale dark:border-zinc-700/50">
                          {formattaNumeroGiornate(offerta.giornateFatturabili)}
                        </td>
                        <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle tabular-nums whitespace-nowrap text-testo-principale dark:border-zinc-700/50">
                          {formattaEuro(offerta.ricavi)}
                        </td>
                        <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle tabular-nums whitespace-nowrap text-testo-principale dark:border-zinc-700/50">
                          {formattaEuro(offerta.costi)}
                          {Number(offerta.fissoRipartito) > 0 && (
                            <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
                              di cui fisso ripartito {formattaEuro(offerta.fissoRipartito)}
                            </div>
                          )}
                        </td>
                        <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle tabular-nums dark:border-zinc-700/50">
                          <ImportoMargine importi={offerta} />
                        </td>
                        <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle tabular-nums whitespace-nowrap text-testo-metadati dark:border-zinc-700/50">
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
              className="flex flex-wrap items-center justify-between gap-4 rounded-[11px] border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-500/20 dark:bg-amber-500/10"
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

          <div
            data-testid="marginalita-totali"
            className="flex flex-wrap items-center justify-end gap-8 rounded-[11px] border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <Cifra etichetta="Ricavi totali">{formattaEuro(report.totali.ricavi)}</Cifra>
            <Cifra etichetta="Costi totali">{formattaEuro(report.totali.costi)}</Cifra>
            <Cifra etichetta="Margine totale">
              <ImportoMargine importi={report.totali} />
            </Cifra>
          </div>
        </>
      )}
    </div>
  );
}

/** Badge del codice offerta: la voce senza offerta è evidenziata come da assegnare. */
export function classeCodiceOfferta(offertaId: string | null): string {
  return offertaId === null
    ? "inline-block w-fit rounded-[6px] border border-amber-200 bg-amber-50 px-2 py-[2px] text-xs font-medium whitespace-nowrap text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
    : "inline-block w-fit rounded-[6px] border border-zinc-200 bg-zinc-50 px-2 py-[2px] text-xs font-medium whitespace-nowrap text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800";
}
