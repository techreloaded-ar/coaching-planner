import { cookies } from "next/headers";
import { disconnetti, risolviProfiloCollaboratoreCorrente, type SessioneUtente } from "@/lib/dal";
import { calendarioCollegato } from "@/lib/proposte-calendario";
import { NOME_COOKIE_SIDEBAR_COMPRESSA } from "@/lib/sidebar-compressa";
import { ProviderImpostazioni } from "./impostazioni/modale-impostazioni";
import SidebarApplicazione from "./sidebar-applicazione";

/**
 * Struttura comune delle aree autenticate (attività e console): sidebar con le
 * voci consentite dai permessi, account in fondo e modale Impostazioni disponibile ovunque.
 * Qui si leggono i dati che la modale mostra (stato del connettore Google
 * Calendar) e la preferenza della sidebar collassata.
 */
export default async function StrutturaApplicazione({
  sessione,
  intestazione,
  children,
}: {
  sessione: SessioneUtente;
  intestazione?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [profilo, cookieStore] = await Promise.all([
    risolviProfiloCollaboratoreCorrente(sessione),
    cookies(),
  ]);
  const collegato =
    profilo.stato === "ATTIVO" ? await calendarioCollegato(profilo.collaboratore.id) : null;

  return (
    <ProviderImpostazioni collegato={collegato} emailAccesso={sessione.email}>
      <SidebarApplicazione
        permessi={sessione.permessi}
        ruolo={sessione.ruolo}
        compressaIniziale={cookieStore.get(NOME_COOKIE_SIDEBAR_COMPRESSA)?.value === "1"}
        nome={sessione.nome}
        email={sessione.email}
        azioneEsci={disconnetti}
        intestazione={intestazione}
      >
        {children}
      </SidebarApplicazione>
    </ProviderImpostazioni>
  );
}
