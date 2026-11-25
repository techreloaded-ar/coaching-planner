/**
 * Feedback immediato delle mutazioni: un elemento appena aggiunto o modificato
 * compare subito a schermo, attenuato e con questa indicazione, finché il
 * server non lo conferma. Se il server rifiuta, l'elemento torna com'era e il
 * chiamante mostra il messaggio d'errore.
 */

/** Classi dell'elemento in attesa di conferma: attenuato e non interattivo. */
export const CLASSE_ELEMENTO_IN_ATTESA = "opacity-60 pointer-events-none select-none";

/** Etichetta «Salvataggio…» con rotellina, annunciata come stato. */
export function IndicatoreSalvataggio({
  etichetta = "Salvataggio…",
  className = "",
}: {
  etichetta?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      data-testid="indicatore-salvataggio"
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 motion-reduce:animate-none dark:border-indigo-800 dark:border-t-indigo-300"
      />
      {etichetta}
    </span>
  );
}

/** Messaggio di una mutazione non riuscita: dice cosa non è stato fatto e perché. */
export function AvvisoMutazioneNonRiuscita({
  messaggio,
  onChiudi,
  className = "",
}: {
  messaggio: string;
  onChiudi?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      data-testid="avviso-mutazione-non-riuscita"
      className={`flex items-start gap-3 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 ${className}`.trim()}
    >
      <span className="min-w-0 flex-1">{messaggio}</span>
      {onChiudi && (
        <button
          type="button"
          onClick={onChiudi}
          aria-label="Chiudi il messaggio"
          className="-my-0.5 cursor-pointer rounded-md px-1.5 text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/40"
        >
          ×
        </button>
      )}
    </div>
  );
}

/** Messaggio per un errore di rete o una risposta inattesa del server. */
export const MESSAGGIO_ERRORE_DI_RETE =
  "Il server non ha risposto: l'operazione non è stata salvata. Controlla la connessione e riprova.";
