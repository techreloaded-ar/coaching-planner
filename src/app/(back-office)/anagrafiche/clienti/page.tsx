import Link from "next/link";
import { richiediRuolo } from "@/lib/dal";
import { elencaClienti } from "@/lib/clienti";
import ClientiTabella from "./clienti-tabella";

export default async function ClientiPage() {
  await richiediRuolo("AMMINISTRATORE");
  const clienti = await elencaClienti();

  return (
    <div>
      {/* Intestazione view */}
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
            Anagrafiche
          </div>
          <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            Clienti
          </h1>
          <p className="mt-[6px] max-w-[560px] text-[13px] text-zinc-400 dark:text-zinc-500">
            I clienti disattivati restano nello storico ma non sono selezionabili per nuove attività e offerte.
          </p>
        </div>
        <div className="mt-1 flex shrink-0 items-center gap-[10px]">
          <Link
            href="/anagrafiche/clienti/nuovo"
            className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[15px] py-[9px] text-[13.5px] font-semibold text-white shadow-sm no-underline transition hover:bg-indigo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nuovo cliente
          </Link>
        </div>
      </div>

      {/* Tabella clienti */}
      <ClientiTabella clienti={clienti} />


    </div>
  );
}
