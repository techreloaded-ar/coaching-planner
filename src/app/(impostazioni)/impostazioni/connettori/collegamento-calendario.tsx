import { scollegaCalendarioGoogle } from "@/lib/actions/calendario-google";
import { PulsanteAttesa } from "@/components";

interface CollegamentoCalendarioProps {
  /** `null` quando l'utente non ha un profilo collaboratore attivo: il connettore non è disponibile */
  collegato: boolean | null;
  /** Esito del ritorno dal consenso Google (`?calendario=`) */
  esito?: string;
  /** Email con cui il collaboratore accede: è l'account Google da autorizzare */
  emailAccesso: string;
}

/**
 * Connettore Google Calendar nelle Impostazioni: stato del collegamento con
 * l'azione coerente. «Collega Google Calendar» avvia il consenso in sola
 * lettura, «Scollega» rimuove il token salvato. Senza profilo collaboratore
 * attivo il connettore non è disponibile e non offre azioni.
 */
export default function CollegamentoCalendario({
  collegato,
  esito,
  emailAccesso,
}: CollegamentoCalendarioProps) {
  return (
    <div aria-label="Calendario Google" role="group">
      {esito === "negato" && !collegato && (
        <p
          role="alert"
          className="mb-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          Collegamento non completato: il consenso a Google Calendar è stato
          negato o non è più valido. Puoi riprovare quando vuoi.
        </p>
      )}
      {esito === "account-diverso" && (
        <p
          role="alert"
          className="mb-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          Collegamento non completato: hai autorizzato un account Google
          diverso da quello con cui accedi. Riprova scegliendo l&apos;account{" "}
          <strong>{emailAccesso}</strong>.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 rounded-[11px] border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 rounded-full ${collegato ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-100">
            {collegato === null
              ? "Calendario Google non disponibile"
              : collegato
                ? "Calendario Google collegato"
                : "Calendario Google non collegato"}
          </p>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
            {collegato === null
              ? "Il connettore serve a proporre le ore dagli impegni: è disponibile solo con un profilo collaboratore attivo."
              : collegato
                ? "Aprendo una giornata ti proponiamo le ore dai tuoi impegni. Accesso in sola lettura."
                : "Collegalo in sola lettura per ricevere le proposte di ore dai tuoi impegni."}
          </p>
        </div>
        {collegato === null ? null : collegato ? (
          <form action={scollegaCalendarioGoogle}>
            <PulsanteAttesa
              etichettaAttesa="Scollegamento…"
              className="inline-flex items-center rounded-[10px] border border-zinc-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Scollega
            </PulsanteAttesa>
          </form>
        ) : (
          // Navigazione documentale verso il consenso Google, non una rotta client.
          <a
            href="/api/calendario-google/collega"
            className="inline-flex items-center rounded-[10px] bg-indigo-600 px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-indigo-700"
          >
            Collega Google Calendar
          </a>
        )}
      </div>
    </div>
  );
}
