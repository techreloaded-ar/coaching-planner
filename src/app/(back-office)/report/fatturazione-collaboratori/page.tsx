import Link from "next/link";
import { richiediPermesso } from "@/lib/dal";
import { reportFatturazioneCollaboratoriMese } from "@/lib/report";
import { descriviImportoTariffa, formattaEuro, formattaNumeroGiornate } from "@/lib/formattazione";
import { urlFoglioDaAmministrazione } from "@/lib/url-foglio-attivita";
import { tokenMeseCorrente, parseTokenMese } from "@/domain/calendario";
import { PulsanteAttesa } from "@/components";
import BarraMese from "./barra-mese";
import { inviaPromemoriaFineMeseOra } from "./actions";

/** Conteggio dalla query string; null se assente o non numerico. */
function conteggio(valore: string | undefined): number | null {
  const numero = Number.parseInt(valore ?? "", 10);
  return Number.isNaN(numero) || numero < 0 ? null : numero;
}

const classeIntestazione =
  "border-b border-zinc-200 bg-white px-5 py-[11px] text-xs font-medium whitespace-nowrap text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800";
const classeCella =
  "border-b border-zinc-100 px-5 py-[13px] align-middle tabular-nums whitespace-nowrap dark:border-zinc-700/50";

export default async function ReportFatturazioneCollaboratoriPage({
  searchParams,
}: {
  searchParams: Promise<{
    mese?: string;
    promemoriaInviati?: string;
    promemoriaFalliti?: string;
  }>;
}) {
  await richiediPermesso("CONSULTARE_REPORT_FATTURAZIONE_COLLABORATORI");

  const params = await searchParams;
  const tokenRaw = params.mese ?? tokenMeseCorrente();
  const token = parseTokenMese(tokenRaw) ? tokenRaw : tokenMeseCorrente();

  const { perCollaboratore, totali } = await reportFatturazioneCollaboratoriMese(token);
  const promemoriaInviati = conteggio(params.promemoriaInviati);
  const promemoriaFalliti = conteggio(params.promemoriaFalliti);

  return (
    // Su smartphone il promemoria scende in fondo: prima mese e fatture
    // attese, poi l'azione rivolta ai collaboratori.
    <div className="grid gap-x-6 sm:grid-cols-[minmax(0,1fr)_auto]">
      {/* Intestazione view */}
      <div className="mb-[22px]">
        <div className="mb-1 text-xs font-medium text-testo-metadati">
          Reportistica
        </div>
        <h1 className="text-[23px] font-semibold tracking-tight text-testo-principale">
          Fatture attese dai collaboratori
        </h1>
        <p className="mt-[6px] max-w-[560px] text-sm text-testo-metadati">
          Riepilogo mensile delle fatture che ogni collaboratore emetterà:
          prestazioni calcolate sulla tariffa valida nel mese più i rimborsi
          trasferta.
        </p>
      </div>

      {/* Azione secondaria: vale per il mese in corso, non per quello mostrato. */}
      <form
        action={inviaPromemoriaFineMeseOra}
        className="flex max-w-[320px] flex-col items-end gap-1.5 text-right max-sm:order-last max-sm:mt-8 max-sm:max-w-none max-sm:items-stretch max-sm:border-t max-sm:border-zinc-200 max-sm:pt-6 max-sm:text-left dark:max-sm:border-zinc-800"
      >
        <PulsanteAttesa
          etichettaAttesa="Invio…"
          className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-testo-secondario shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-800 max-sm:min-h-11 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:hover:text-zinc-100"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-4 w-4"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          Invia promemoria di fine mese
        </PulsanteAttesa>
        <p className="text-xs text-testo-metadati">
          Invia subito l&apos;email a tutti i collaboratori attivi: completare le
          attività ed emettere la fattura del mese in corso
        </p>
      </form>

      {/* Esito dell'invio manuale del promemoria */}
      {promemoriaInviati !== null && promemoriaFalliti !== null && (
        <div
          role="status"
          className={
            promemoriaFalliti === 0
              ? "mb-4 rounded-xl sm:col-span-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "mb-4 rounded-xl sm:col-span-2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          }
        >
          Promemoria inviati: {promemoriaInviati}. Non riusciti: {promemoriaFalliti}.
        </div>
      )}

      <div className="min-w-0 sm:col-span-2">
        <div className="mb-6 flex flex-wrap items-center gap-4 max-sm:gap-2.5">
          <BarraMese token={token} />
          <div className="flex-1 max-sm:hidden" />
          <div
            data-testid="riepilogo-fatture-attese"
            className="inline-flex items-center gap-[9px] rounded-full border border-indigo-200 bg-indigo-50 px-[14px] py-1.5 text-sm font-medium text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300"
          >
            <span>
              <b className="tabular-nums">{totali.fattureAttese}</b>{" "}
              {totali.fattureAttese === 1 ? "fattura attesa" : "fatture attese"}
            </span>
            <span className="h-[13px] w-px bg-indigo-200 dark:bg-indigo-500/40" />
            <b className="tabular-nums">{formattaEuro(totali.importoAtteso)}</b>
          </div>
        </div>

        {perCollaboratore.length === 0 ? (
          <div className="rounded-[11px] border border-zinc-200 bg-white p-10 text-center text-sm text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800">
            Nessun collaboratore per questo mese.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`${classeIntestazione} text-left`}>Collaboratore</th>
                  <th className={`${classeIntestazione} text-left`}>Tariffa</th>
                  <th className={`${classeIntestazione} text-right`}>Giornate fatturabili</th>
                  <th className={`${classeIntestazione} text-right`}>Prestazioni</th>
                  <th className={`${classeIntestazione} text-right`}>Rimborsi trasferta</th>
                  <th className={`${classeIntestazione} text-right`}>Importo atteso</th>
                </tr>
              </thead>
              <tbody>
                {perCollaboratore.map((voce) => (
                  <tr
                    key={voce.collaboratoreId}
                    data-testid={`fattura-collaboratore-${voce.collaboratoreId}`}
                    className={
                      voce.foglioVuoto
                        ? "text-testo-metadati"
                        : "text-testo-principale"
                    }
                  >
                    <td className={classeCella}>
                      <Link
                        href={urlFoglioDaAmministrazione(voce.collaboratoreId, { mese: token })}
                        className={`font-semibold hover:underline ${
                          voce.foglioVuoto
                            ? "text-testo-metadati"
                            : "text-indigo-600 dark:text-indigo-400"
                        }`}
                      >
                        {voce.collaboratoreNome}
                      </Link>
                      {voce.foglioVuoto && (
                        <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-[2px] text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                          Foglio vuoto
                        </span>
                      )}
                    </td>
                    <td className={classeCella}>
                      {voce.modalitaTariffa
                        ? descriviImportoTariffa(voce.modalitaTariffa, voce.importoTariffa)
                        : "—"}
                    </td>
                    <td className={`${classeCella} text-right`}>
                      {formattaNumeroGiornate(voce.giornateDaFatturare)}
                    </td>
                    <td className={`${classeCella} text-right`}>{formattaEuro(voce.prestazioni)}</td>
                    <td className={`${classeCella} text-right`}>{formattaEuro(voce.rimborsiTrasferta)}</td>
                    <td
                      className={`${classeCella} text-right text-sm font-semibold ${
                        voce.foglioVuoto && Number(voce.importoAtteso) === 0
                          ? ""
                          : "text-indigo-600 dark:text-indigo-400"
                      }`}
                    >
                      {formattaEuro(voce.importoAtteso)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  data-testid="totale-fatture-collaboratori"
                  className="bg-zinc-50 font-semibold text-testo-principale dark:bg-zinc-800/60"
                >
                  <td className={classeCella}>Totale</td>
                  <td className={classeCella} />
                  <td className={`${classeCella} text-right`}>
                    {formattaNumeroGiornate(totali.giornateDaFatturare)}
                  </td>
                  <td className={`${classeCella} text-right`}>{formattaEuro(totali.prestazioni)}</td>
                  <td className={`${classeCella} text-right`}>{formattaEuro(totali.rimborsiTrasferta)}</td>
                  <td className={`${classeCella} text-right text-sm text-indigo-600 dark:text-indigo-400`}>
                    {formattaEuro(totali.importoAtteso)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
