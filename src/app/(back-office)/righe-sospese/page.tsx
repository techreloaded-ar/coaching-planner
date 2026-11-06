import { richiediRuolo } from "@/lib/dal";
import { elencaRigheSospese } from "@/lib/righe-sospese";
import { leggiPosizioneElenco } from "@/lib/paginazione";
import { leggiFiltroRigheSospese } from "@/domain/righe-sospese";
import RigheSospeseTabella from "./righe-sospese-tabella";
import Link from "next/link";

interface RigheSospesePageProps {
  searchParams: Promise<{
    pagina?: string | string[];
    stato?: string | string[];
    motivo?: string | string[];
  }>;
}

export default async function RigheSospesePage({ searchParams }: RigheSospesePageProps) {
  await richiediRuolo("AMMINISTRATORE");
  const parametri = await searchParams;
  const { pagina } = leggiPosizioneElenco(parametri);
  const elenco = await elencaRigheSospese({ pagina, filtro: leggiFiltroRigheSospese(parametri) });

  return (
    <div>
      <Link href="/importazione" className="mb-4 inline-block text-sm text-indigo-600 underline dark:text-indigo-400">Torna a Importazione</Link>
      {/* Intestazione view */}
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
            Import
          </div>
          <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            Righe sospese
          </h1>
          <p className="mt-[6px] max-w-[560px] text-[13px] text-zinc-400 dark:text-zinc-500">
            Righe dell&apos;import Excel non abbinate alle anagrafiche.
          </p>
        </div>
        <div
          role="status"
          aria-label="Righe aperte"
          className="min-w-[150px] rounded-[11px] border border-zinc-200 bg-white px-[18px] py-[14px] shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
            Righe aperte
          </div>
          <div className="text-[26px] font-bold tabular-nums text-zinc-800 dark:text-zinc-100">
            {elenco.totaleRigheAperte}
          </div>
        </div>
      </div>

      <RigheSospeseTabella elenco={elenco} />
    </div>
  );
}
