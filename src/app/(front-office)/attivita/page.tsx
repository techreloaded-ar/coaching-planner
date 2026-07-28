import {
  risolviProfiloCollaboratoreCorrente,
  verificaSessione,
} from "@/lib/dal";
import { datiCalendarioMesePerCollaboratoreAutorizzato } from "@/lib/attivita";
import { tokenMeseCorrente, parseTokenMese } from "@/domain/calendario";
import CalendarioMensile from "./calendario-mensile";
import StatoProfiloCollaboratore from "./stato-profilo-collaboratore";

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
  const datiMese = await datiCalendarioMesePerCollaboratoreAutorizzato(
    token,
    profilo.collaboratore.id
  );

  return (
    <CalendarioMensile
      datiMeseIniziale={datiMese}
      oggi={new Date().toISOString()}
    />
  );
}
