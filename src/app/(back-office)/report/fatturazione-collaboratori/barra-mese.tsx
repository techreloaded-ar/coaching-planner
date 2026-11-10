"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SelettoreMese } from "@/components";
import { mesePrecedente, meseSuccessivo } from "@/domain/calendario";

const PERCORSO_REPORT = "/report/fatturazione-collaboratori";

const classePulsanteFreccia =
  "flex h-9 w-9 items-center justify-center max-sm:h-11 max-sm:w-11 rounded-[10px] border border-zinc-200 bg-white text-testo-metadati shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:hover:text-zinc-200";

/**
 * Navigazione del mese del report: frecce, salto diretto e mese corrente.
 * Su smartphone frecce e mese stanno sulla prima riga, «Mese corrente» sotto.
 */
export default function BarraMese({ token }: { token: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2.5 max-sm:grid max-sm:w-full max-sm:grid-cols-[2.75rem_1fr_1fr_2.75rem]">
      <Link
        href={`${PERCORSO_REPORT}?mese=${mesePrecedente(token)}`}
        className={classePulsanteFreccia}
        aria-label="Mese precedente"
        title="Mese precedente"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[18px] w-[18px]">
          <path d="m15 6-6 6 6 6" />
        </svg>
      </Link>

      <div className="max-sm:col-span-2">
        <SelettoreMese
          tokenVisualizzato={token}
          onScegliMese={(mese) => router.push(`${PERCORSO_REPORT}?mese=${mese}`)}
        />
      </div>

      <Link
        href={`${PERCORSO_REPORT}?mese=${meseSuccessivo(token)}`}
        className={classePulsanteFreccia}
        aria-label="Mese successivo"
        title="Mese successivo"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[18px] w-[18px]">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </Link>

      <Link
        href={PERCORSO_REPORT}
        className="ml-1 inline-flex items-center gap-[7px] max-sm:col-span-4 max-sm:ml-0 max-sm:min-h-11 max-sm:justify-center rounded-[10px] border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-medium text-testo-metadati shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4l2.5 1.5" />
        </svg>
        Mese corrente
      </Link>
    </div>
  );
}
