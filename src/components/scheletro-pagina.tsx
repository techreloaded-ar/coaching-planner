// Kit di scheletri di caricamento: blocchi grigi animati che riproducono
// l'impaginazione delle pagine reali (intestazione, barra strumenti, card
// tabella, griglia del calendario), così il passaggio scheletro → dati non fa
// saltare il contenuto. Nessun hook: usabile da Server e Client Component.

const CLASSE_BLOCCO =
  "block animate-pulse rounded-md bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800";

/** Larghezze fisse a rotazione: niente casualità, quindi niente differenze tra server e client. */
const LARGHEZZE_CELLA = ["w-[72%]", "w-[54%]", "w-[63%]", "w-[45%]", "w-[80%]", "w-[58%]"] as const;

/** Barra grigia animata; dimensioni e forma arrivano da `className`. */
export function BloccoScheletro({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`${CLASSE_BLOCCO} ${className}`} />;
}

/**
 * Contenitore di uno scheletro: annunciato alle tecnologie assistive come
 * caricamento in corso, con l'animazione sospesa se l'utente preferisce
 * il movimento ridotto (lo fanno i singoli blocchi).
 */
export function ScheletroPagina({
  variante,
  className = "",
  children,
}: {
  /** Tipo di pagina riprodotta, esposto come `data-variante`. */
  variante?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid="scheletro-pagina"
      data-variante={variante}
      className={className}
    >
      <span className="sr-only">Caricamento in corso…</span>
      {children}
    </div>
  );
}

/**
 * Intestazione di pagina: occhiello, titolo (h1 da 23 px) e descrizione, con
 * il pulsante d'azione principale a destra quando la pagina ne ha uno.
 */
export function TitoloScheletro({
  conOcchiello = true,
  conDescrizione = true,
  conAzione = false,
}: {
  conOcchiello?: boolean;
  conDescrizione?: boolean;
  conAzione?: boolean;
}) {
  return (
    <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        {conOcchiello && <BloccoScheletro className="mb-2 h-3 w-20" />}
        <BloccoScheletro className="h-[26px] w-52 max-w-full" />
        {conDescrizione && <BloccoScheletro className="mt-[10px] h-3.5 w-[min(460px,90%)]" />}
      </div>
      {conAzione && <BloccoScheletro className="mt-1 h-[38px] w-36 rounded-[10px]" />}
    </div>
  );
}

/** Barra strumenti di una card elenco: campo di ricerca e, a destra, un filtro o pulsante. */
export function BarraStrumentiScheletro() {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-[14px] dark:border-zinc-800">
      <BloccoScheletro className="h-[38px] w-full max-w-[320px] flex-1 rounded-[10px]" />
      <BloccoScheletro className="ml-auto h-[34px] w-44 rounded-[9px] max-sm:hidden" />
    </div>
  );
}

/** Card tabella con intestazione di colonna e `righe` righe grigie. */
export function TabellaScheletro({
  righe = 8,
  colonne = 4,
  conBarraStrumenti = true,
}: {
  righe?: number;
  colonne?: number;
  conBarraStrumenti?: boolean;
}) {
  const indiciColonne = Array.from({ length: colonne }, (_, indice) => indice);
  return (
    <div className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {conBarraStrumenti && <BarraStrumentiScheletro />}
      <div className="flex gap-4 border-b border-zinc-200 px-4 py-[13px] dark:border-zinc-800">
        {indiciColonne.map((colonna) => (
          <div key={colonna} className={`${colonna === 0 ? "flex-[2]" : "flex-1"} ${colonna > 1 ? "max-sm:hidden" : ""}`}>
            <BloccoScheletro className="h-3 w-16" />
          </div>
        ))}
      </div>
      {Array.from({ length: righe }, (_, riga) => (
        <div
          key={riga}
          className="flex items-center gap-4 border-b border-zinc-100 px-4 py-[15px] last:border-b-0 dark:border-zinc-800"
        >
          {indiciColonne.map((colonna) => (
            <div key={colonna} className={`${colonna === 0 ? "flex-[2]" : "flex-1"} ${colonna > 1 ? "max-sm:hidden" : ""}`}>
              <BloccoScheletro
                className={`h-3.5 ${LARGHEZZE_CELLA[(riga + colonna * 2) % LARGHEZZE_CELLA.length]}`}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Griglia del calendario mensile: intestazione dei giorni e 6 settimane × 7 giorni. */
export function GrigliaCalendarioScheletro() {
  return (
    <div className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-700">
        {Array.from({ length: 7 }, (_, giorno) => (
          <div key={giorno} className="px-3 py-3 max-sm:flex max-sm:justify-center max-sm:px-0">
            <BloccoScheletro className="h-3 w-8 max-sm:w-4" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[minmax(124px,auto)] max-sm:auto-rows-[minmax(64px,auto)]">
        {Array.from({ length: 42 }, (_, cella) => (
          <div
            key={cella}
            className="flex flex-col gap-3 border-b border-r border-zinc-100 p-2 nth-[7n]:border-r-0 nth-last-[-n+7]:border-b-0 max-sm:items-center dark:border-zinc-800"
          >
            <BloccoScheletro className="h-7 w-7 rounded-full max-sm:h-[26px] max-sm:w-[26px]" />
            {cella % 3 === 1 && <BloccoScheletro className="h-3 w-3/4 max-sm:hidden" />}
          </div>
        ))}
      </div>
    </div>
  );
}
