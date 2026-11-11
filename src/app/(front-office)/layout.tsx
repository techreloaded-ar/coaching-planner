import {
  risolviProfiloCollaboratoreCorrente,
  verificaSessione,
} from "@/lib/dal";
import { collaboratoriDelSelettore } from "@/lib/foglio-attivita";
import StrutturaApplicazione from "@/app/struttura-applicazione";
import SelettoreFoglioAttivita from "./selettore-foglio-attivita";

export default async function FrontOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessione = await verificaSessione();
  const consultaFogliAltrui = sessione.permessi.includes("CONSULTARE_FOGLI_ATTIVITA_ALTRUI");

  // Solo per chi può consultare i fogli altrui il titolo diventa il selettore
  // del foglio: l'elenco dei collaboratori non viene mai letto per gli altri utenti.
  const [collaboratori, profilo] = consultaFogliAltrui
    ? await Promise.all([
        collaboratoriDelSelettore(sessione),
        risolviProfiloCollaboratoreCorrente(sessione),
      ])
    : [[], null];

  return (
    <StrutturaApplicazione
      sessione={sessione}
      intestazione={
        consultaFogliAltrui ? (
          <SelettoreFoglioAttivita
            collaboratori={collaboratori}
            proprioCollaboratoreId={
              profilo?.stato === "ATTIVO" ? profilo.collaboratore.id : null
            }
            nomeUtente={sessione.nome}
          />
        ) : (
          <h1 className="text-lg font-medium tracking-tight text-testo-principale">
            Le mie attività
          </h1>
        )
      }
    >
      <main className="flex-1">{children}</main>
    </StrutturaApplicazione>
  );
}
