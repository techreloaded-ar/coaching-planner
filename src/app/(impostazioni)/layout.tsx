import { disconnetti, risolviProfiloCollaboratoreCorrente, verificaSessione } from "@/lib/dal";
import { LogoCoachingPlanner, MenuAccount } from "@/components";
import NavigazioneImpostazioni from "./navigazione-impostazioni";

/**
 * Area Impostazioni: intestazione propria (senza contesto front office o
 * console), barra laterale con le categorie e il contenuto della categoria
 * aperta. L'uscita riporta alle attività chi ha un profilo collaboratore
 * utilizzabile (collaboratore, o amministratore che è anche collaboratore),
 * alla console l'amministratore senza profilo collaboratore attivo.
 */
export default async function ImpostazioniLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessione = await verificaSessione();
  const profilo = await risolviProfiloCollaboratoreCorrente(sessione);
  const tornaAlleAttivita = sessione.ruolo === "COLLABORATORE" || profilo.stato === "ATTIVO";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 md:flex md:gap-5 md:px-8">
          <LogoCoachingPlanner />
          <div aria-hidden="true" className="hidden h-[26px] w-px shrink-0 bg-zinc-200 md:block dark:bg-zinc-700" />
          <h1 className="col-span-2 row-start-2 text-[22px] font-bold tracking-tight text-zinc-800 md:text-lg md:font-medium dark:text-zinc-100">
            Impostazioni
          </h1>
          <div className="col-start-2 row-start-1 justify-self-end md:ml-auto">
            <MenuAccount
              nome={sessione.nome}
              email={sessione.email}
              ruolo={sessione.ruolo === "AMMINISTRATORE" ? "Amministratore" : "Collaboratore"}
              azioneEsci={disconnetti}
            />
          </div>
        </div>
      </header>
      {/* Barra laterale ancorata al bordo sinistro della vista, contenuto a fianco */}
      <div className="flex w-full flex-1 max-sm:flex-col">
        <NavigazioneImpostazioni
          uscita={
            tornaAlleAttivita
              ? { href: "/attivita", etichetta: "Torna alle attività" }
              : { href: "/anagrafiche", etichetta: "Torna alla console" }
          }
        />
        <main className="min-w-0 flex-1 px-8 py-8 max-sm:px-4 max-sm:py-5">
          <div className="max-w-[720px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
