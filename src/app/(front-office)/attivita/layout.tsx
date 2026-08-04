import { verificaSessione } from "@/lib/dal";
import AttivitaCacheProvider from "./attivita-cache-provider";

/**
 * Confine dell'area attività.
 *
 * Resta un Server Component: risolve la sessione (memoizzata nella richiesta,
 * quindi non aggiunge letture) e monta le cache dell'area attività — mesi del
 * calendario, giornate e contesto di inserimento — attorno a `/attivita` e alle
 * sue route figlie, così le cache sopravvivono alla navigazione verso il
 * dettaglio giornata e al ritorno al calendario.
 */
export default async function AttivitaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessione = await verificaSessione();

  return (
    <AttivitaCacheProvider
      key={sessione.utenteId}
      chiaveSessione={sessione.utenteId}
    >
      {children}
    </AttivitaCacheProvider>
  );
}
