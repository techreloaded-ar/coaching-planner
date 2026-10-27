import { richiediRuolo } from "@/lib/dal";
import { reportFatturazioneClientiMese } from "@/lib/report";
import { tokenMeseCorrente, parseTokenMese } from "@/domain/calendario";
import { PulsanteAttesa } from "@/components";
import ReportFatturazioneClienti from "./report-fatturazione-clienti";
import { inviaPromemoriaFineMeseOra } from "./actions";

/** Conteggio dalla query string; null se assente o non numerico. */
function conteggio(valore: string | undefined): number | null {
  const numero = Number.parseInt(valore ?? "", 10);
  return Number.isNaN(numero) || numero < 0 ? null : numero;
}

export default async function ReportFatturazioneClientiPage({
  searchParams,
}: {
  searchParams: Promise<{
    mese?: string;
    promemoriaInviati?: string;
    promemoriaFalliti?: string;
  }>;
}) {
  await richiediRuolo("AMMINISTRATORE");

  const params = await searchParams;

  // Token del mese: da query string o mese corrente
  const tokenRaw = params.mese ?? tokenMeseCorrente();
  const parsed = parseTokenMese(tokenRaw);
  const token = parsed ? tokenRaw : tokenMeseCorrente();

  // Dati del report — serializzati per il passaggio al Client Component
  const risultato = await reportFatturazioneClientiMese(token);
  const report = JSON.parse(JSON.stringify(risultato));

  const promemoriaInviati = conteggio(params.promemoriaInviati);
  const promemoriaFalliti = conteggio(params.promemoriaFalliti);

  return (
    <div>
      {/* Intestazione view */}
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
            Reportistica
          </div>
          <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            Importi da fatturare per cliente
          </h1>
          <p className="mt-[6px] max-w-[560px] text-[13px] text-zinc-400 dark:text-zinc-500">
            Riepilogo mensile degli importi da fatturare a ciascun cliente, con
            manodopera e rimborsi trasferta calcolati sulle tariffe di offerta.
          </p>
        </div>
        <form action={inviaPromemoriaFineMeseOra} className="flex flex-col items-end gap-[6px]">
          <PulsanteAttesa
            etichettaAttesa="Invio…"
            className="inline-flex items-center gap-2 rounded-[10px] bg-indigo-600 px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-indigo-700"
          >
            Invia promemoria di fine mese
          </PulsanteAttesa>
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500">
            Invia subito l&apos;email a tutti i collaboratori attivi
          </p>
        </form>
      </div>

      {/* Esito dell'invio manuale del promemoria */}
      {promemoriaInviati !== null && promemoriaFalliti !== null && (
        <div
          role="status"
          className={
            promemoriaFalliti === 0
              ? "mb-[18px] rounded-[11px] border border-emerald-200 bg-emerald-50 p-[15px] text-[13px] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "mb-[18px] rounded-[11px] border border-amber-200 bg-amber-50 p-[15px] text-[13px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          }
        >
          Promemoria inviati: {promemoriaInviati}. Non riusciti: {promemoriaFalliti}.
        </div>
      )}

      {/* Il mese iniziale arriva dal server; i cambi mese successivi sono
          serviti dalla cache client del componente. */}
      <ReportFatturazioneClienti report={report} />
    </div>
  );
}
