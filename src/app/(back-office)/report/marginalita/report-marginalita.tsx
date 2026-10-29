import type { RisultatoReportMarginalita } from "@/lib/report";
import type { ImportiMarginalita } from "@/domain/consuntivi";
import { formattaEuro, inizialiCliente } from "@/lib/formattazione";

const formattatoreGiornate = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const formattatorePercentuale = new Intl.NumberFormat("it-IT", {
  style: "percent",
  maximumFractionDigits: 1,
});

const classeIntestazioneColonna =
  "border-b border-zinc-200 bg-white px-5 py-[11px] text-[10.5px] font-bold uppercase tracking-[0.05em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500";

const classeCampoMese =
  "rounded-[9px] border border-zinc-200 bg-white px-3 py-[7px] text-[13.5px] text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";

/** Margine in euro, in rosso e con badge testuale quando è negativo. */
function ImportoMargine({ importi }: { importi: ImportiMarginalita }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <span
        className={
          importi.margineNegativo
            ? "font-bold text-red-600 dark:text-red-400"
            : "font-bold text-zinc-800 dark:text-zinc-100"
        }
      >
        {formattaEuro(importi.margine)}
      </span>
      {importi.margineNegativo && (
        <span className="rounded-full bg-red-50 px-2 py-[2px] text-[10.5px] font-bold whitespace-nowrap text-red-600 dark:bg-red-500/15 dark:text-red-300">
          Margine negativo
        </span>
      )}
    </span>
  );
}

function percentuale(importi: ImportiMarginalita): string {
  return importi.marginePercentuale === null
    ? "—"
    : formattatorePercentuale.format(importi.marginePercentuale);
}

function Cifra({
  etichetta,
  children,
}: {
  etichetta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-right leading-[1.15]">
      <span className="mb-[3px] block text-[10.5px] font-bold uppercase tracking-[0.05em] text-zinc-400 dark:text-zinc-500">
        {etichetta}
      </span>
      <span className="text-[17px] tabular-nums text-zinc-800 dark:text-zinc-100">
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
              className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400"
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
              className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400"
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
            className="rounded-[9px] bg-indigo-600 px-4 py-[8px] text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Applica
          </button>
        </form>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
          Periodo: <b className="text-zinc-800 dark:text-zinc-100">{etichettaPeriodo}</b>
        </p>
      </div>

      {report.perCliente.length === 0 && Number(report.fissiNonAttribuibili) === 0 ? (
        <div className="rounded-[11px] border border-dashed border-zinc-300 bg-white px-5 py-10 text-center text-[14px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-indigo-50 text-[14px] font-extrabold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                    {inizialiCliente(cliente.clienteRagioneSociale)}
                  </div>
                  <div className="min-w-0 leading-[1.3]">
                    <h2 className="text-[16px] font-bold -tracking-[0.01em] text-zinc-800 dark:text-zinc-100">
                      {cliente.clienteRagioneSociale}
                    </h2>
                    <span className="text-[12px] tabular-nums text-zinc-400 dark:text-zinc-500">
                      {formattatoreGiornate.format(cliente.giornateFatturabili)}{" "}
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
                <table className="w-full border-collapse text-[13.5px]">
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
                        key={offerta.offertaId}
                        data-testid={`marginalita-offerta-${offerta.offertaId}`}
                        className={
                          offerta.margineNegativo
                            ? "bg-red-50/60 dark:bg-red-500/10"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        }
                      >
                        <td className="border-b border-zinc-100 px-5 py-[13px] align-middle dark:border-zinc-700/50">
                          <span className="inline-block w-fit rounded-[6px] border border-zinc-200 bg-zinc-50 px-2 py-[2px] text-[11px] font-bold whitespace-nowrap text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                            {offerta.offertaCodice}
                          </span>
                        </td>
                        <td className="border-b border-zinc-100 px-5 py-[13px] align-middle text-[12.5px] text-zinc-500 dark:border-zinc-700/50 dark:text-zinc-400">
                          {offerta.offertaDescrizione}
                        </td>
                        <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle tabular-nums whitespace-nowrap text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                          {formattatoreGiornate.format(offerta.giornateFatturabili)}
                        </td>
                        <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle tabular-nums whitespace-nowrap text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                          {formattaEuro(offerta.ricavi)}
                        </td>
                        <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle tabular-nums whitespace-nowrap text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                          {formattaEuro(offerta.costi)}
                          {Number(offerta.fissoRipartito) > 0 && (
                            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                              di cui fisso ripartito {formattaEuro(offerta.fissoRipartito)}
                            </div>
                          )}
                        </td>
                        <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle tabular-nums dark:border-zinc-700/50">
                          <ImportoMargine importi={offerta} />
                        </td>
                        <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle tabular-nums whitespace-nowrap text-zinc-500 dark:border-zinc-700/50 dark:text-zinc-400">
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
                <div className="text-[14px] font-bold text-zinc-800 dark:text-zinc-100">Fissi non attribuibili</div>
                <div className="text-[12px] text-zinc-500 dark:text-zinc-400">
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
