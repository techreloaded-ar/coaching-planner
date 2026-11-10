import { richiediRuolo } from "@/lib/dal";
import { reportMarginalitaPeriodo } from "@/lib/report";
import {
  tokenMeseCorrente,
  normalizzaPeriodoMesi,
  etichettaMese,
} from "@/domain/calendario";
import { ComeVieneCalcolato } from "@/components";
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
      <div className="mb-6">
        <div className="mb-1 text-xs font-medium text-testo-metadati">
          Reportistica
        </div>
        <h1 className="text-[23px] font-semibold tracking-tight text-testo-principale max-sm:text-[21px]">
          Marginalità per cliente e offerta
        </h1>
        <p className="mt-1.5 max-w-[560px] text-sm text-testo-metadati">
          Ricavi, costi dei collaboratori e margine di ogni cliente nei mesi scelti
        </p>
      </div>

      <ReportMarginalita
        da={da}
        a={a}
        etichettaPeriodo={etichettaPeriodo}
        report={report}
      />

      <ComeVieneCalcolato>
        <li>
          Ricavi: giornate Fatturabile (ore divise per 8) × tariffa
          dell&apos;offerta, arrotondati come nel report di fatturazione clienti.
        </li>
        <li>
          Costi: tariffa del collaboratore valida in ciascun mese. Con tariffa
          giornaliera contano le ore Fatturabile e Non fatturabile, che il
          collaboratore fattura ad Agile Reloaded; con tariffa a percentuale le
          sole Fatturabile, al compenso giornaliero (tariffa dell&apos;offerta
          meno la trattenuta).
        </li>
        <li>
          I fissi mensili si ripartiscono sulle offerte in proporzione alle ore
          Fatturabile e Non fatturabile del collaboratore nel mese. Se nel mese
          non ci sono ore, il fisso è tra i «Fissi non attribuibili» e pesa
          solo sul totale.
        </li>
        <li>Le ore di Investimento e i rimborsi trasferta sono esclusi.</li>
        <li>
          Margine = ricavi − costi; il margine % è calcolato sui ricavi. Un
          margine sotto zero è segnalato in rosso con la scritta «Margine
          negativo».
        </li>
      </ComeVieneCalcolato>
    </div>
  );
}
