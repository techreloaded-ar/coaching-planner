import { richiediRuolo } from "@/lib/dal";
import { reportMarginalitaPeriodo } from "@/lib/report";
import {
  tokenMeseCorrente,
  normalizzaPeriodoMesi,
  etichettaMese,
} from "@/domain/calendario";
import ReportMarginalita from "./report-marginalita";

export default async function ReportMarginalitaPage({
  searchParams,
}: {
  searchParams: Promise<{ da?: string; a?: string }>;
}) {
  await richiediRuolo("AMMINISTRATORE");

  const params = await searchParams;
  const { da, a } = normalizzaPeriodoMesi(
    params.da,
    params.a,
    tokenMeseCorrente(),
  );
  const etichettaPeriodo =
    da === a ? etichettaMese(da) : `${etichettaMese(da)} – ${etichettaMese(a)}`;

  const report = await reportMarginalitaPeriodo(da, a);

  return (
    <div>
      <div className="mb-[22px]">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
          Reportistica
        </div>
        <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
          Marginalità per cliente e offerta
        </h1>
        <p className="mt-[6px] max-w-[640px] text-[13px] text-zinc-400 dark:text-zinc-500">
          Confronto per periodo tra i ricavi dai clienti (tariffe offerta) e i
          costi dei collaboratori (tariffa collaboratore valida in ogni mese).
          I ricavi considerano le sole ore Fatturabile; i costi le ore
          Fatturabile e Non fatturabile, che il collaboratore fattura ad Agile
          Reloaded. I fissi mensili si ripartiscono sulle offerte in proporzione
          alle ore del collaboratore nel mese. Le ore di Investimento e i
          rimborsi trasferta sono esclusi.
        </p>
      </div>

      <ReportMarginalita
        da={da}
        a={a}
        etichettaPeriodo={etichettaPeriodo}
        report={report}
      />
    </div>
  );
}
