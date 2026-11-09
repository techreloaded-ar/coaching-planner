import Link from "next/link";
import { richiediRuolo } from "@/lib/dal";
import { reportFatturazioneCollaboratoriMese } from "@/lib/report";
import { descriviImportoTariffa, formattaEuro } from "@/lib/formattazione";
import { urlFoglioDaAmministrazione } from "@/lib/url-foglio-attivita";
import { tokenMeseCorrente, parseTokenMese } from "@/domain/calendario";
import BarraMese from "./barra-mese";

const formattatoreGiornate = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const classeIntestazione =
  "border-b border-zinc-200 bg-white px-5 py-[11px] text-[10.5px] font-bold uppercase tracking-[0.05em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500";
const classeCella =
  "border-b border-zinc-100 px-5 py-[13px] align-middle tabular-nums whitespace-nowrap dark:border-zinc-700/50";

export default async function ReportFatturazioneCollaboratoriPage({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string }>;
}) {
  await richiediRuolo("AMMINISTRATORE");

  const params = await searchParams;
  const tokenRaw = params.mese ?? tokenMeseCorrente();
  const token = parseTokenMese(tokenRaw) ? tokenRaw : tokenMeseCorrente();

  const { perCollaboratore, totali } = await reportFatturazioneCollaboratoriMese(token);

  return (
    <div>
      {/* Intestazione view */}
      <div className="mb-[22px]">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
          Reportistica
        </div>
        <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
          Fatture attese dai collaboratori
        </h1>
        <p className="mt-[6px] max-w-[560px] text-[13px] text-zinc-400 dark:text-zinc-500">
          Riepilogo mensile delle fatture che ogni collaboratore emetterà:
          prestazioni calcolate sulla tariffa valida nel mese più i rimborsi
          trasferta.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <BarraMese token={token} />
        <div className="flex-1" />
        <div
          data-testid="riepilogo-fatture-attese"
          className="inline-flex items-center gap-[9px] rounded-full border border-indigo-200 bg-indigo-50 px-[14px] py-1.5 text-[12.5px] font-semibold text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300"
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
        <div className="rounded-[11px] border border-zinc-200 bg-white p-10 text-center text-[13.5px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
          Nessun collaboratore per questo mese.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <table className="w-full border-collapse text-[13.5px]">
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
                      ? "text-zinc-400 dark:text-zinc-500"
                      : "text-zinc-800 dark:text-zinc-100"
                  }
                >
                  <td className={classeCella}>
                    <Link
                      href={urlFoglioDaAmministrazione(voce.collaboratoreId, { mese: token })}
                      className={`font-semibold hover:underline ${
                        voce.foglioVuoto
                          ? "text-zinc-500 dark:text-zinc-400"
                          : "text-indigo-600 dark:text-indigo-400"
                      }`}
                    >
                      {voce.collaboratoreNome}
                    </Link>
                    {voce.foglioVuoto && (
                      <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-[2px] text-[11px] font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
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
                    {formattatoreGiornate.format(voce.giornateDaFatturare)}
                  </td>
                  <td className={`${classeCella} text-right`}>{formattaEuro(voce.prestazioni)}</td>
                  <td className={`${classeCella} text-right`}>{formattaEuro(voce.rimborsiTrasferta)}</td>
                  <td
                    className={`${classeCella} text-right text-[14px] font-extrabold ${
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
                className="bg-zinc-50 font-extrabold text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-100"
              >
                <td className={classeCella}>Totale</td>
                <td className={classeCella} />
                <td className={`${classeCella} text-right`}>
                  {formattatoreGiornate.format(totali.giornateDaFatturare)}
                </td>
                <td className={`${classeCella} text-right`}>{formattaEuro(totali.prestazioni)}</td>
                <td className={`${classeCella} text-right`}>{formattaEuro(totali.rimborsiTrasferta)}</td>
                <td className={`${classeCella} text-right text-[14px] text-indigo-600 dark:text-indigo-400`}>
                  {formattaEuro(totali.importoAtteso)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
