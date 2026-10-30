import { redirect } from "next/navigation";
import {
  risolviProfiloCollaboratoreCorrente,
  verificaSessione,
} from "@/lib/dal";
import {
  righeDelGiornoPerCollaboratoreAutorizzato,
  contestoInserimentoPerCollaboratoreAutorizzato,
} from "@/lib/attivita";
import { collaboratoreConsultatoDellaPagina } from "@/lib/foglio-attivita";
import { urlDelFoglio } from "@/lib/url-foglio-attivita";
import { parseDataGiorno } from "@/domain/calendario";
import { calendarioCollegato } from "@/lib/proposte-calendario";
import IsolaGiornata from "./isola-giornata";
import StatoProfiloCollaboratore from "../stato-profilo-collaboratore";
import BannerFoglioConsultato from "../banner-foglio-consultato";

// ═══════════════════════════════════════════════════════════════
// Pagina
// ═══════════════════════════════════════════════════════════════

export default async function DettaglioGiornataPage({
  params,
  searchParams,
}: {
  params: Promise<{ data: string }>;
  searchParams: Promise<{ mese?: string; collaboratore?: string }>;
}) {
  const sessione = await verificaSessione();
  const { data: dataStr } = await params;
  const { mese: meseToken, collaboratore: collaboratoreRichiesto } =
    await searchParams;

  // Foglio di un altro collaboratore, aperto da un amministratore.
  const consultato = await collaboratoreConsultatoDellaPagina(
    sessione,
    collaboratoreRichiesto
  );

  let collaboratoreId: string;
  if (consultato) {
    collaboratoreId = consultato.id;
  } else {
    // La sessione è già verificata: il resolver del profilo la riusa invece
    // di risolverla una seconda volta.
    const profilo = await risolviProfiloCollaboratoreCorrente(sessione);

    if (profilo.stato !== "ATTIVO") {
      return (
        <StatoProfiloCollaboratore
          stato={profilo.stato}
          amministratore={sessione.ruolo === "AMMINISTRATORE"}
        />
      );
    }
    collaboratoreId = profilo.collaboratore.id;
  }

  // Validazione data
  if (!parseDataGiorno(dataStr)) {
    redirect(urlDelFoglio("/attivita", consultato?.id));
  }

  // Dati letti con il collaboratore già autorizzato: la giornata e il contesto
  // di inserimento sono prodotti dalle stesse letture usate dai route handler,
  // così rendering server ed endpoint non possono divergere. Le proposte del
  // calendario Google sono personali: sul foglio consultato non si mostrano.
  const [datiGiornata, contestoInserimento, collegato] = await Promise.all([
    righeDelGiornoPerCollaboratoreAutorizzato(dataStr, collaboratoreId),
    contestoInserimentoPerCollaboratoreAutorizzato(collaboratoreId),
    consultato ? false : calendarioCollegato(collaboratoreId),
  ]);

  // L'isola client possiede breadcrumb, cambio giorno e giornata mostrata: non
  // riceve alcun `key`, perché deve sopravvivere ai cambi giorno scritti con la
  // History API — è ciò che rende il cambio giorno una lettura dalla cache
  // invece di una navigazione RSC. Il remount che azzera il form è passato sul
  // componente di dettaglio, dentro l'isola.
  return (
    <>
      {consultato && <BannerFoglioConsultato collaboratore={consultato} />}
      <IsolaGiornata
        datiGiornataIniziale={datiGiornata}
        contestoIniziale={contestoInserimento}
        meseToken={meseToken}
        calendarioCollegato={collegato}
        solaLettura={consultato ? !consultato.attivo : false}
      />
    </>
  );
}
