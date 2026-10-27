import { richiediRuolo } from "@/lib/dal";
import { reportFatturazioneClientiMese } from "@/lib/report";
import { tokenMeseCorrente, parseTokenMese } from "@/domain/calendario";
import ReportFatturazioneClienti from "./report-fatturazione-clienti";

export default async function ReportFatturazioneClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string }>;
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
      </div>

      {/* Il mese iniziale arriva dal server; i cambi mese successivi sono
          serviti dalla cache client del componente. */}
      <ReportFatturazioneClienti report={report} />
    </div>
  );
}
