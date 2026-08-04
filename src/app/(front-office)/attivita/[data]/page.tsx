import { redirect } from "next/navigation";
import {
  risolviProfiloCollaboratoreCorrente,
  verificaSessione,
} from "@/lib/dal";
import {
  righeDelGiornoPerCollaboratoreAutorizzato,
  contestoInserimentoPerCollaboratoreAutorizzato,
} from "@/lib/attivita";
import { parseDataGiorno } from "@/domain/calendario";
import IsolaGiornata from "./isola-giornata";
import StatoProfiloCollaboratore from "../stato-profilo-collaboratore";

// ═══════════════════════════════════════════════════════════════
// Pagina
// ═══════════════════════════════════════════════════════════════

export default async function DettaglioGiornataPage({
  params,
  searchParams,
}: {
  params: Promise<{ data: string }>;
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

  const { data: dataStr } = await params;
  const { mese: meseToken } = await searchParams;

  // Validazione data
  if (!parseDataGiorno(dataStr)) {
    redirect("/attivita");
  }

  // Dati letti con il collaboratore già autorizzato: la giornata e il contesto
  // di inserimento sono prodotti dalle stesse letture usate dai route handler,
  // così rendering server ed endpoint non possono divergere.
  const [datiGiornata, contestoInserimento] = await Promise.all([
    righeDelGiornoPerCollaboratoreAutorizzato(dataStr, profilo.collaboratore.id),
    contestoInserimentoPerCollaboratoreAutorizzato(profilo.collaboratore.id),
  ]);

  // L'isola client possiede breadcrumb, cambio giorno e giornata mostrata: non
  // riceve alcun `key`, perché deve sopravvivere ai cambi giorno scritti con la
  // History API — è ciò che rende il cambio giorno una lettura dalla cache
  // invece di una navigazione RSC. Il remount che azzera il form è passato sul
  // componente di dettaglio, dentro l'isola.
  return (
    <IsolaGiornata
      datiGiornataIniziale={datiGiornata}
      contestoIniziale={contestoInserimento}
      meseToken={meseToken}
    />
  );
}
