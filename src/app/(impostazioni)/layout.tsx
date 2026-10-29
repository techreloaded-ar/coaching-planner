import { disconnetti, risolviProfiloCollaboratoreCorrente, verificaSessione } from "@/lib/dal";
import { LogoAgileReloaded, MenuAccount } from "@/components";
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
        <div className="flex items-center gap-5 px-8 py-3.5 max-sm:gap-3 max-sm:px-4">
          <LogoAgileReloaded />
          <div aria-hidden="true" className="h-[26px] w-px shrink-0 bg-zinc-200 max-lg:hidden dark:bg-zinc-700" />
          <h1 className="text-[22px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            Impostazioni
          </h1>
          <div className="flex-1" />
          <MenuAccount
            nome={sessione.nome}
            email={sessione.email}
            ruolo={sessione.ruolo === "AMMINISTRATORE" ? "Amministratore" : "Collaboratore"}
            azioneEsci={disconnetti}
          />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[960px] flex-1 gap-8 px-8 py-8 max-sm:flex-col max-sm:gap-4 max-sm:px-4">
        <NavigazioneImpostazioni
          uscita={
            tornaAlleAttivita
              ? { href: "/attivita", etichetta: "Torna alle attività" }
              : { href: "/anagrafiche", etichetta: "Torna alla console" }
          }
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
