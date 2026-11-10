import { richiediRuolo } from "@/lib/dal";
import { reportFatturazioneClientiMese } from "@/lib/report";
import { tokenMeseCorrente, parseTokenMese } from "@/domain/calendario";
import { ComeVieneCalcolato, PulsanteAttesa } from "@/components";
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
    // Su smartphone il promemoria scende in fondo: prima mese, esportazione e
    // fatture, poi l'azione rivolta ai collaboratori.
    <div className="grid gap-x-6 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div>
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

      {/* Azione secondaria: non dipende dal mese mostrato nel report. */}
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
          className={`mt-4 sm:col-span-2 ${
            promemoriaFalliti === 0
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          }`}
        >
          Promemoria inviati: {promemoriaInviati}. Non riusciti: {promemoriaFalliti}.
        </div>
      )}

      {/* Il mese iniziale arriva dal server; i cambi mese successivi sono
          serviti dalla cache client del componente. */}
      <div className="mt-6 min-w-0 sm:col-span-2">
        <ReportFatturazioneClienti report={report} />
      </div>

      <div className="sm:col-span-2">
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
    </div>
  );
}
