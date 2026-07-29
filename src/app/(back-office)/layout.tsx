import { disconnetti, richiediRuolo } from "@/lib/dal";
import ConsoleSidebar from "@/app/(back-office)/console-sidebar";
import { PulsanteAttesa } from "@/components";

export default async function BackOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessione = await richiediRuolo("AMMINISTRATORE");
  const iniziali = sessione.nome
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar fissa a sinistra */}
      <ConsoleSidebar
        nome={sessione.nome}
        ruolo="Amministratore"
        iniziali={iniziali}
      />

      {/* Area contenuto — margin-left = larghezza sidebar */}
      <div className="ml-[248px] max-[920px]:ml-[66px] flex min-h-screen flex-col">
        {/* Header sottile con pulsante Esci */}
        <header className="sticky top-0 z-10 flex items-center justify-end gap-4 border-b border-zinc-200 bg-white/80 px-8 py-2.5 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <b className="block text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">
                {sessione.nome}
              </b>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Amministratore
              </span>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[13px] font-bold text-white">
              {iniziali}
            </div>
            <div className="mx-1 h-[26px] w-px bg-zinc-200 dark:bg-zinc-700" />
            <form action={disconnetti}>
              <PulsanteAttesa
                data-esci
                etichettaAttesa="Uscita…"
                className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2}>
                  <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="m16 17 5-5-5-5M21 12H9" />
                </svg>
                Esci
              </PulsanteAttesa>
            </form>
          </div>
        </header>
        <main className="flex-1 px-9 py-[30px]">{children}</main>
      </div>
    </div>
  );
}
