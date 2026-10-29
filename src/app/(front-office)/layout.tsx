import Link from "next/link";
import { disconnetti, verificaSessione } from "@/lib/dal";
import { LogoAgileReloaded, MenuAccount } from "@/components";
import TitoloFrontOffice from "./titolo-front-office";

export default async function FrontOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessione = await verificaSessione();

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
            <TitoloFrontOffice />
          </div>
          <div className="flex-1" />

          <div className="flex items-center gap-3.5">
            {sessione.ruolo === "AMMINISTRATORE" && (
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
