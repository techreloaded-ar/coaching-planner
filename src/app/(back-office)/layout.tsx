import { disconnetti, utenteCorrente } from "@/lib/dal";

export default async function BackOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessione = await utenteCorrente();
  const iniziali = sessione
    ? sessione.nome
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center gap-5 px-8 py-3.5">
          <div>
            <div className="text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
              Back office
            </div>
            <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
              Report per cliente
            </h1>
          </div>
          <div className="flex-1" />

          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-2.5 rounded-[11px] px-2 py-1.5">
              <div className="text-right leading-tight">
                <b className="block text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-100">
                  {sessione?.nome}
                </b>
                <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
                  Amministratore · {sessione?.email}
                </span>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[13px] font-bold text-white">
                {iniziali}
              </div>
            </div>
            <div className="h-[26px] w-px bg-zinc-200 dark:bg-zinc-700" />

            <form action={disconnetti}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-zinc-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
                  <path d="m16 17 5-5-5-5M21 12H9" />
                </svg>
                Esci
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
