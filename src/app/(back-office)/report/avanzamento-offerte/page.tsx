import { richiediRuolo } from "@/lib/dal";
import { reportAvanzamentoOfferte } from "@/lib/report";
import ReportAvanzamentoOfferte from "./report-avanzamento-offerte";

export default async function ReportAvanzamentoOffertePage() {
  await richiediRuolo("AMMINISTRATORE");

  // Dati del report — serializzati per il passaggio al Client Component
  const risultato = await reportAvanzamentoOfferte();
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
            Avanzamento offerte
          </h1>
          <p className="mt-[6px] max-w-[560px] text-[13px] text-zinc-400 dark:text-zinc-500">
            Per ogni offerta le giornate previste, quelle erogate (1 giornata
            = 8 ore) e il residuo, con il dettaglio per collaboratore. Vista
            cumulativa sul ciclo di vita dell&apos;offerta: ricalcola sempre i
            dati correnti delle attività registrate.
          </p>
        </div>
      </div>

      <ReportAvanzamentoOfferte report={report} />
    </div>
  );
}
