import { verificaSessione } from "@/lib/dal";
import CalendarioCacheProvider from "./calendario-cache-provider";

/**
 * Confine dell'area attività.
 *
 * Resta un Server Component: risolve la sessione (memoizzata nella richiesta,
 * quindi non aggiunge letture) e monta la cache dei mesi del calendario attorno
 * a `/attivita` e alle sue route figlie, così la cache sopravvive alla
 * navigazione verso il dettaglio giornata e al ritorno al calendario.
 */
export default async function AttivitaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessione = await verificaSessione();

  return (
    <CalendarioCacheProvider
      key={sessione.utenteId}
      chiaveSessione={sessione.utenteId}
    >
      {children}
    </CalendarioCacheProvider>
  );
}
