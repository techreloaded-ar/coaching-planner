import { formattaEuro } from "@/lib/formattazione";

/** Tooltip del valore calcolato di un'offerta a giornata: l'importo totale. */
export const CALCOLATO_DA_TARIFFA = "Calcolato da tariffa giornaliera";
/** Tooltip del valore calcolato di un'offerta a corpo: la tariffa giornaliera. */
export const CALCOLATA_DA_CORPO = "Calcolata da offerta a corpo";

/**
 * Quale dei due importi di un'offerta è calcolato: a giornata l'importo
 * totale (tariffa × giorni), a corpo la tariffa (importo ÷ giorni).
 */
export function tooltipImportiOfferta(modalitaPrezzo: string): {
  tariffa?: string;
  importoTotale?: string;
} {
  return modalitaPrezzo === "A_CORPO"
    ? { tariffa: CALCOLATA_DA_CORPO }
    : { importoTotale: CALCOLATO_DA_TARIFFA };
}

/**
 * Tariffa o importo totale di un'offerta in euro («—» se assente). Se il
 * valore è calcolato, lo precede una piccola icona grigia «calcolatrice»
 * con il tooltip `calcolatoDa`, che è anche il nome accessibile dell'icona.
 */
export function ImportoOfferta({
  valore,
  calcolatoDa,
}: {
  valore: string | null;
  calcolatoDa?: string;
}) {
  if (valore === null || !calcolatoDa) return <>{formattaEuro(valore)}</>;

  return (
    <span className="group/calcolo relative inline-flex items-center gap-[5px]">
      <svg
        role="img"
        aria-label={calcolatoDa}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="h-[13px] w-[13px] shrink-0 text-zinc-400 dark:text-zinc-500"
      >
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2" />
      </svg>
      {formattaEuro(valore)}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-0 bottom-full z-10 mb-[6px] whitespace-nowrap rounded-[6px] bg-zinc-800 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-100 group-hover/calcolo:opacity-100 group-hover/calcolo:delay-150 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {calcolatoDa}
      </span>
    </span>
  );
}
