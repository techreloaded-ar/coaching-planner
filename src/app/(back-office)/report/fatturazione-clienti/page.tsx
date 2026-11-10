import { richiediRuolo } from "@/lib/dal";
import { reportFatturazioneClientiMese } from "@/lib/report";
import { tokenMeseCorrente, parseTokenMese } from "@/domain/calendario";
import { ComeVieneCalcolato } from "@/components";
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
      <div className="mb-6">
        <div className="mb-1 text-xs font-medium text-testo-metadati">
          Reportistica
        </div>
        <h1 className="text-[23px] max-sm:text-[21px] font-semibold tracking-tight text-testo-principale">
          Importi da fatturare per cliente
        </h1>
        <p className="mt-1.5 max-w-[560px] text-sm text-testo-metadati">
          Una fattura per cliente: manodopera e trasferte forfettarie del mese
        </p>
      </div>

      {/* Il mese iniziale arriva dal server; i cambi mese successivi sono
          serviti dalla cache client del componente. */}
      <ReportFatturazioneClienti report={report} />

      <ComeVieneCalcolato>
        <li>
          Le giornate sono le ore Fatturabile del mese divise per 8.
          L&apos;imponibile manodopera di ogni offerta è giornate × tariffa
          giornaliera dell&apos;offerta.
        </li>
        <li>
          Le ore registrate senza offerta compaiono come voce da assegnare con
          importo zero; un&apos;offerta senza tariffa mostra «tariffa da
          definire» e imponibile zero.
        </li>
        <li>
          Per le offerte con trasferta forfettaria si fattura il forfait
          dell&apos;offerta per ogni collaboratore e giorno con un rimborso
          trasferta registrato, qualunque sia la categoria delle ore. Per le
          altre offerte la trasferta è inclusa nella tariffa. I rimborsi pagati ai collaboratori non sono ribaltati al
          cliente.
        </li>
        <li>
          Da fatturare = imponibile manodopera + trasferte forfettarie. Il
          totale del mese è la somma delle fatture dei clienti.
        </li>
      </ComeVieneCalcolato>
    </div>
  );
}
