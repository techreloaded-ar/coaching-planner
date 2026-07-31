import Link from "next/link";
import { richiediRuolo } from "@/lib/dal";
import { elencaVociRimborso } from "@/lib/voci-rimborso";
import VociRimborsoTabella from "./voci-rimborso-tabella";

interface VociRimborsoPageProps {
  searchParams: Promise<{ esito?: string }>;
}

export default async function VociRimborsoPage({ searchParams }: VociRimborsoPageProps) {
  await richiediRuolo("AMMINISTRATORE");
  const vociRimborso = await elencaVociRimborso();
  const { esito } = await searchParams;

  const messaggioEsito =
    esito === "creato"
      ? "Voce di rimborso creata e inserita nella configurazione"
      : esito === "salvato"
        ? "Modifiche alla voce di rimborso salvate"
        : esito === "eliminato"
          ? "Voce di rimborso eliminata"
          : null;

  return (
    <div>
      {/* Banner di esito */}
      {messaggioEsito && (
        <div className="mb-[18px] flex items-start gap-[11px] rounded-[11px] border border-emerald-200 bg-emerald-50 p-[15px] text-[13px] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-[2px] h-[16px] w-[16px] shrink-0" strokeWidth={2}>
            <circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 5-5" />
          </svg>
          <span>{messaggioEsito}</span>
        </div>
      )}

      {/* Intestazione view */}
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
            Anagrafiche
          </div>
          <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            Voci di rimborso trasferta
          </h1>
          <p className="mt-[6px] max-w-[560px] text-[13px] text-zinc-400 dark:text-zinc-500">
            Per ogni voce definisci un&apos;etichetta descrittiva e l&apos;importo forfettario del
            rimborso trasferta riconosciuto quando la voce viene applicata.
          </p>
        </div>
        <div className="mt-1 flex shrink-0 items-center gap-[10px]">
          <Link
            href="/anagrafiche/voci-rimborso/nuovo"
            className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[15px] py-[9px] text-[13.5px] font-semibold text-white shadow-sm no-underline transition hover:bg-indigo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nuova voce di rimborso
          </Link>
        </div>
      </div>

      {/* Tabella voci di rimborso */}
      <VociRimborsoTabella
        vociRimborso={vociRimborso.map((voce) => ({
          ...voce,
          importo: voce.importo.toString(),
        }))}
      />
    </div>
  );
}
