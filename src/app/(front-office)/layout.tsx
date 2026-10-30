import Link from "next/link";
import {
  disconnetti,
  risolviProfiloCollaboratoreCorrente,
  verificaSessione,
} from "@/lib/dal";
import { collaboratoriDelSelettore } from "@/lib/foglio-attivita";
import { LogoAgileReloaded, MenuAccount } from "@/components";
import SelettoreFoglioAttivita from "./selettore-foglio-attivita";

export default async function FrontOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessione = await verificaSessione();
  const amministratore = sessione.ruolo === "AMMINISTRATORE";

  // Solo per un amministratore il titolo diventa il selettore del foglio:
  // l'elenco dei collaboratori non viene mai letto per gli altri utenti.
  const [collaboratori, profilo] = amministratore
    ? await Promise.all([
        collaboratoriDelSelettore(sessione),
        risolviProfiloCollaboratoreCorrente(sessione),
      ])
    : [[], null];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center gap-5 px-8 py-3.5 max-sm:gap-3 max-sm:px-4">
          <LogoAgileReloaded />
          <div aria-hidden="true" className="h-[26px] w-px shrink-0 bg-zinc-200 max-lg:hidden dark:bg-zinc-700" />
          <div>
            <div className="text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
              Front office
            </div>
            {amministratore ? (
              <SelettoreFoglioAttivita
                collaboratori={collaboratori}
                proprioCollaboratoreId={
                  profilo?.stato === "ATTIVO" ? profilo.collaboratore.id : null
                }
                nomeUtente={sessione.nome}
              />
            ) : (
              <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
                Le mie attività
              </h1>
            )}
          </div>
          <div className="flex-1" />

          <div className="flex items-center gap-3.5">
            {amministratore && (
              <Link
                href="/anagrafiche"
                className="inline-flex items-center rounded-[10px] border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[12.5px] font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
              >
                Console amministrativa
              </Link>
            )}
            <MenuAccount
              nome={sessione.nome}
              email={sessione.email}
              ruolo={sessione.ruolo === "AMMINISTRATORE" ? "Amministratore" : "Collaboratore"}
              azioneEsci={disconnetti}
            />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
