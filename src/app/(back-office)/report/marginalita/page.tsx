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
        <div className="mb-1 text-xs font-medium text-testo-metadati">
          Reportistica
        </div>
        <h1 className="text-[23px] font-semibold tracking-tight text-testo-principale">
          Marginalità per cliente e offerta
        </h1>
        <p className="mt-[6px] max-w-[640px] text-sm text-testo-metadati">
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
