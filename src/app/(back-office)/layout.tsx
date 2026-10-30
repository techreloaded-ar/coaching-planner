import { disconnetti, richiediRuolo } from "@/lib/dal";
import ConsoleSidebar from "@/app/(back-office)/console-sidebar";
import { MenuAccount } from "@/components";

export default async function BackOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessione = await richiediRuolo("AMMINISTRATORE");

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar fissa a sinistra */}
      <ConsoleSidebar />

      {/* Area contenuto — margin-left = larghezza sidebar */}
      <div className="ml-[248px] max-[920px]:ml-[66px] flex min-h-screen flex-col">
        {/* Il brand resta nella sidebar; l'header ospita il menu dell'account. */}
        <header className="sticky top-0 z-10 flex min-h-[57px] items-center justify-end gap-4 border-b border-zinc-200 bg-white/80 px-8 py-2.5 max-sm:gap-2 max-sm:px-4 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/80">
          <MenuAccount
            nome={sessione.nome}
            email={sessione.email}
            ruolo="Amministratore"
            azioneEsci={disconnetti}
          />
        </header>
        <main className="flex-1 px-9 py-[30px]">{children}</main>
      </div>
    </div>
  );
}
