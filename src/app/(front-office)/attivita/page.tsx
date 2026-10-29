import Link from "next/link";
import {
  risolviProfiloCollaboratoreCorrente,
  verificaSessione,
} from "@/lib/dal";
import { datiCalendarioMesePerCollaboratoreAutorizzato } from "@/lib/attivita";
import { tokenMeseCorrente, parseTokenMese } from "@/domain/calendario";
import CalendarioMensile from "./calendario-mensile";
import StatoProfiloCollaboratore from "./stato-profilo-collaboratore";
import { calendarioCollegato } from "@/lib/proposte-calendario";

export default async function AttivitaPage({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string }>;
}) {
  const sessione = await verificaSessione();
  // La sessione è già verificata: il resolver del profilo la riusa invece di
  // risolverla una seconda volta.
  const profilo = await risolviProfiloCollaboratoreCorrente(sessione);

  if (profilo.stato !== "ATTIVO") {
    return (
      <StatoProfiloCollaboratore
        stato={profilo.stato}
        amministratore={sessione.ruolo === "AMMINISTRATORE"}
      />
    );
  }

  const params = await searchParams;

  // Token del mese: da query string o mese corrente
  const tokenRaw = params.mese ?? tokenMeseCorrente();
  const parsed = parseTokenMese(tokenRaw);
  const token = parsed ? tokenRaw : tokenMeseCorrente();

  // Dati del mese letti con il collaboratore già autorizzato: la query non
  // ripete la catena sessione → profilo. Etichetta del mese e griglia delle 42
  // celle sono derivate nel client dalle funzioni pure del dominio, quindi non
  // vengono serializzate nel payload.
  const [datiMese, collegato] = await Promise.all([
    datiCalendarioMesePerCollaboratoreAutorizzato(token, profilo.collaboratore.id),
    calendarioCollegato(profilo.collaboratore.id),
  ]);

  return (
    <>
      {/* Solo stato, discreto: il collegamento si gestisce dalle Impostazioni. */}
      <div className="mx-auto flex w-full max-w-[1080px] justify-end px-8 pt-4">
        <Link
          href="/impostazioni/connettori"
          className="inline-flex items-center gap-1.5 text-[11.5px] text-zinc-400 transition hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${collegato ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
          />
          {collegato ? "Google Calendar collegato" : "Google Calendar non collegato"}
        </Link>
      </div>
      <CalendarioMensile
        datiMeseIniziale={datiMese}
        oggi={new Date().toISOString()}
      />
    </>
  );
}
