import type { AvanzamentoGiornateOfferta } from "@/domain/consuntivi";
import { formattaNumeroGiornate } from "@/lib/formattazione";

/** Formatta un numero di giornate con al massimo un decimale, stile it-IT. */
function formattaGiornate(valore: number | null): string {
  return valore === null ? "—" : formattaNumeroGiornate(valore);
}

interface IndicatoreGiorniErogatiProps {
  avanzamento: AvanzamentoGiornateOfferta;
  /** Disposizione su una riga (accanto a un'etichetta) invece che in colonna. */
  inRiga?: boolean;
}

/**
 * Avanzamento in giornate di un'offerta: «erogate/previste gg», mini barra e
 * segnalazione «Esaurita» / «Oltre budget». È la cella «Giorni erogati»
 * dell'anagrafica offerte, riusata nell'area attività del collaboratore.
 */
export function IndicatoreGiorniErogati({
  avanzamento,
  inRiga = false,
}: IndicatoreGiorniErogatiProps) {
  const { giornateErogate, giorniPrevisti, stato } = avanzamento;
  const oltreBudget = stato === "OLTRE_BUDGET";
  const esaurita = stato === "ESAURITA";
  const percentuale =
    giorniPrevisti !== null && giorniPrevisti > 0
      ? Math.min((giornateErogate / giorniPrevisti) * 100, 100)
      : 0;

  return (
    <div
      data-testid="indicatore-giorni-erogati"
      className={`inline-flex whitespace-nowrap ${
        inRiga ? "items-center gap-2" : "flex-col items-end gap-[5px]"
      }`}
    >
      <span className="tabular-nums font-semibold text-testo-principale">
        {formattaGiornate(giornateErogate)}
        <span className="font-semibold text-testo-metadati">/</span>
        {formattaGiornate(giorniPrevisti)}
        <span className="ml-[3px] text-xs font-medium text-testo-metadati">
          gg
        </span>
      </span>
      {giorniPrevisti !== null && (
        <span
          className="relative h-[5px] w-[72px] overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700/50"
          role="img"
          aria-label={`Erogato ${Math.round(percentuale)}% del previsto`}
        >
          <span
            className={`absolute inset-y-0 left-0 rounded-full ${
              oltreBudget
                ? "bg-[repeating-linear-gradient(45deg,theme(colors.red.500)_0_6px,theme(colors.red.700)_6px_12px)]"
                : esaurita
                  ? "bg-red-500"
                  : "bg-indigo-500"
            }`}
            style={{ width: `${percentuale}%` }}
          />
        </span>
      )}
      {oltreBudget && (
        <span className="inline-flex items-center gap-[4px] text-xs font-medium text-red-600 dark:text-red-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[12px] w-[12px]" strokeWidth={2.2}>
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
          Oltre budget
        </span>
      )}
      {esaurita && (
        <span className="inline-flex items-center gap-[4px] text-xs font-medium text-red-600 dark:text-red-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[12px] w-[12px]" strokeWidth={2.2}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          Esaurita
        </span>
      )}
    </div>
  );
}
