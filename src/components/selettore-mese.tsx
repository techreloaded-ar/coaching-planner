"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as EventoTastieraReact,
} from "react";
import {
  etichettaMese,
  formattaTokenMese,
  parseTokenMese,
  tokenMeseCorrente,
  NOMI_MESI_ABBREVIATI,
} from "@/domain/calendario";

// ═══════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════

interface SelettoreMeseProps {
  /** Token YYYY-MM del mese effettivamente in griglia. */
  tokenVisualizzato: string;
  /** Notifica la scelta di un mese; la navigazione è del chiamante. */
  onScegliMese: (token: string) => void;
}

// ═══════════════════════════════════════════════════════════════
// Componente
// ═══════════════════════════════════════════════════════════════

/**
 * Etichetta del mese come unico ingresso al salto diretto.
 *
 * Il pannello è un popover ancorato, non una modale: nessun velo, nessun
 * blocco dello scroll e nessun focus trap, perché la griglia sotto resta
 * leggibile e l'utente deve poterne uscire con un clic qualsiasi.
 *
 * Il componente non naviga: notifica il token scelto e lascia al chiamante
 * l'intento di navigazione, così cache, prefetch, indicatore di attesa e
 * scrittura dell'URL restano quelli già usati da frecce e «Mese corrente».
 */
export function SelettoreMese({
  tokenVisualizzato,
  onScegliMese,
}: SelettoreMeseProps) {
  const [aperto, setAperto] = useState(false);
  const [annoMostrato, setAnnoMostrato] = useState(
    () => parseTokenMese(tokenVisualizzato)?.anno ?? new Date().getFullYear()
  );
  const [indiceMeseAttivo, setIndiceMeseAttivo] = useState(
    () => (parseTokenMese(tokenVisualizzato)?.mese ?? 1) - 1
  );

  const riferimentoContenitore = useRef<HTMLDivElement | null>(null);
  const riferimentoTrigger = useRef<HTMLButtonElement | null>(null);
  const riferimentiCelleMese = useRef<(HTMLButtonElement | null)[]>([]);
  /**
   * Indice corrente letto dai gestori di tastiera. Serve perché due pressioni
   * ravvicinate non vedrebbero lo stato aggiornato dalla precedente e la
   * seconda ripartirebbe dalla posizione già superata.
   */
  const riferimentoIndice = useRef(indiceMeseAttivo);
  /**
   * Il focus segue la cella attiva solo quando è la tastiera a spostarla o
   * all'apertura: senza questa guardia un clic sui pulsanti anno strapperebbe
   * il focus dal pulsante appena premuto, rendendo impossibile scorrere più
   * anni di seguito senza mouse.
   */
  const focusSullaCellaAttiva = useRef(false);

  const etichettaVisualizzata = etichettaMese(tokenVisualizzato);
  const annoVisualizzato = parseTokenMese(tokenVisualizzato)?.anno ?? null;
  const fuoriDallAnnoInGriglia =
    annoVisualizzato !== null && annoVisualizzato !== annoMostrato;

  /**
   * L'apertura riparte sempre dal mese in griglia: due aperture consecutive
   * non conservano un anno stantio lasciato da una navigazione senza scelta.
   */
  function apri() {
    const parsed = parseTokenMese(tokenVisualizzato);
    if (parsed) {
      setAnnoMostrato(parsed.anno);
      setIndiceMeseAttivo(parsed.mese - 1);
      riferimentoIndice.current = parsed.mese - 1;
    }
    focusSullaCellaAttiva.current = true;
    setAperto(true);
  }

  const chiudi = useCallback((riportaFocus: boolean) => {
    setAperto(false);
    focusSullaCellaAttiva.current = false;
    if (riportaFocus) riferimentoTrigger.current?.focus();
  }, []);

  function scegliMese(indice: number) {
    const token = formattaTokenMese(annoMostrato, indice + 1);
    // Il focus torna sull'etichetta, cioè dove l'utente era: la cella scelta
    // sparisce con il pannello e lasciarlo cadere su `body` farebbe ripartire
    // il Tab successivo dall'inizio del documento.
    chiudi(true);
    onScegliMese(token);
  }

  /** Sposta la cella attiva, tenendo allineato il riferimento sincrono. */
  function spostaCellaAttiva(indice: number, deltaAnno: number) {
    focusSullaCellaAttiva.current = true;
    riferimentoIndice.current = indice;
    setIndiceMeseAttivo(indice);
    if (deltaAnno !== 0) setAnnoMostrato((anno) => anno + deltaAnno);
  }

  /**
   * Frecce nella griglia dei mesi. Orizzontalmente il movimento non si ferma
   * al bordo dell'anno: da gennaio si passa a dicembre dell'anno precedente e
   * da dicembre a gennaio del successivo, così anche un mese lontano è
   * raggiungibile senza mai toccare il mouse.
   */
  function gestisciTastiGriglia(evento: EventoTastieraReact<HTMLDivElement>) {
    const indice = riferimentoIndice.current;

    if (evento.key === "ArrowRight") {
      evento.preventDefault();
      if (indice < 11) spostaCellaAttiva(indice + 1, 0);
      else spostaCellaAttiva(0, 1);
      return;
    }

    if (evento.key === "ArrowLeft") {
      evento.preventDefault();
      if (indice > 0) spostaCellaAttiva(indice - 1, 0);
      else spostaCellaAttiva(11, -1);
      return;
    }

    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      if (indice + 3 <= 11) spostaCellaAttiva(indice + 3, 0);
      return;
    }

    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      if (indice - 3 >= 0) spostaCellaAttiva(indice - 3, 0);
    }
  }

  // All'apertura il focus va sulla cella del mese in griglia; a ogni
  // spostamento da tastiera segue la cella attiva, che è ciò che rende reale
  // la navigazione senza mouse. È un layout effect perché deve concludersi
  // prima che il browser possa consegnare la pressione successiva.
  useLayoutEffect(() => {
    if (!aperto || !focusSullaCellaAttiva.current) return;
    riferimentiCelleMese.current[indiceMeseAttivo]?.focus({
      preventScroll: true,
    });
    focusSullaCellaAttiva.current = false;
  }, [aperto, indiceMeseAttivo]);

  // Chiusura con Esc: il focus torna sull'etichetta, cioè dove l'utente era.
  useEffect(() => {
    if (!aperto) return;
    function alTasto(evento: KeyboardEvent) {
      if (evento.key === "Escape") chiudi(true);
    }
    document.addEventListener("keydown", alTasto);
    return () => document.removeEventListener("keydown", alTasto);
  }, [aperto, chiudi]);

  // Chiusura con un clic fuori dal selettore: nessun overlay a tutto schermo,
  // quindi il clic raggiunge comunque l'elemento sottostante.
  useEffect(() => {
    if (!aperto) return;
    function alMouseDown(evento: MouseEvent) {
      const bersaglio = evento.target;
      if (
        bersaglio instanceof Node &&
        riferimentoContenitore.current?.contains(bersaglio)
      ) {
        return;
      }
      chiudi(false);
    }
    document.addEventListener("mousedown", alMouseDown);
    return () => document.removeEventListener("mousedown", alMouseDown);
  }, [aperto, chiudi]);

  return (
    <div className="relative" ref={riferimentoContenitore}>
      <button
        type="button"
        ref={riferimentoTrigger}
        data-testid="calendar-month-label"
        aria-haspopup="dialog"
        aria-expanded={aperto}
        title="Scegli il mese"
        onClick={() => (aperto ? chiudi(false) : apri())}
        className={`inline-flex min-w-[188px] cursor-pointer items-center justify-center gap-2 rounded-[10px] border px-[13px] py-[5px] text-zinc-800 transition hover:border-rose-200 hover:bg-rose-50 focus-visible:border-rose-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-100 dark:text-zinc-100 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:focus-visible:ring-rose-950 ${
          aperto
            ? "border-rose-200 bg-rose-50 shadow-sm dark:border-rose-800 dark:bg-rose-950/40"
            : "border-transparent"
        }`}
      >
        <span className="whitespace-nowrap text-[19px] font-bold capitalize -tracking-[0.02em]">
          {etichettaVisualizzata}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`h-[17px] w-[17px] flex-none text-rose-600 transition-transform duration-200 dark:text-rose-400 ${
            aperto ? "rotate-180" : ""
          }`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {aperto && (
        <div
          role="dialog"
          aria-label="Scelta del mese"
          data-testid="selettore-mese-pannello"
          className="absolute left-1/2 top-full z-30 mt-2.5 w-[272px] -translate-x-1/2 rounded-[13px] border border-zinc-200 bg-white p-[11px] shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {/* Becco: aggancia visivamente il pannello all'etichetta, così si
              legge come una continuazione del titolo e non come una finestra
              separata. Due quadrati ruotati, bordo sotto e superficie sopra. */}
          <span
            aria-hidden="true"
            className="absolute -top-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-zinc-200 dark:bg-zinc-700"
          />
          <span
            aria-hidden="true"
            className="absolute -top-[6px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white dark:bg-zinc-900"
          />

          {/* ── Navigazione dell'anno ── */}
          <div className="mb-[9px] flex items-center justify-between gap-1.5 border-b border-zinc-100 pb-[9px] dark:border-zinc-800">
            <button
              type="button"
              aria-label="Anno precedente"
              title="Anno precedente"
              onClick={() => setAnnoMostrato(annoMostrato - 1)}
              className="grid h-[29px] w-[29px] flex-none cursor-pointer place-items-center rounded-[9px] border border-zinc-200 bg-white text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-600 focus-visible:border-rose-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-750 dark:hover:text-zinc-300 dark:focus-visible:ring-rose-950"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.3}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-[15px] w-[15px]"
              >
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>

            <span className="flex-1 text-center" aria-live="polite">
              <span
                data-testid="selettore-mese-anno"
                className="block text-[15.5px] font-bold tabular-nums tracking-[0.01em] text-zinc-800 dark:text-zinc-100"
              >
                {annoMostrato}
              </span>
              {fuoriDallAnnoInGriglia && (
                // Senza questa riga un pannello privo di evidenziazione
                // resterebbe muto sul perché nessun mese è acceso.
                <span className="block text-[9.5px] font-bold uppercase tracking-[0.06em] text-zinc-400 dark:text-zinc-500">
                  in griglia: {etichettaVisualizzata}
                </span>
              )}
            </span>

            <button
              type="button"
              aria-label="Anno successivo"
              title="Anno successivo"
              onClick={() => setAnnoMostrato(annoMostrato + 1)}
              className="grid h-[29px] w-[29px] flex-none cursor-pointer place-items-center rounded-[9px] border border-zinc-200 bg-white text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-600 focus-visible:border-rose-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-750 dark:hover:text-zinc-300 dark:focus-visible:ring-rose-950"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.3}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-[15px] w-[15px]"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>

          {/* ── Griglia dei dodici mesi ── */}
          <div
            role="group"
            aria-label="Mesi dell'anno"
            onKeyDown={gestisciTastiGriglia}
            className="grid grid-cols-3 gap-1.5"
          >
            {NOMI_MESI_ABBREVIATI.map((abbreviazione, i) => {
              const token = formattaTokenMese(annoMostrato, i + 1);
              const inGriglia = token === tokenVisualizzato;
              const isMeseOdierno = token === tokenMeseCorrente();

              return (
                <button
                  // La chiave è lo slot del mese, non il token: cambiando anno
                  // le dodici celle restano gli stessi nodi e il focus da
                  // tastiera non cade su `body` per un istante.
                  key={abbreviazione}
                  type="button"
                  ref={(elemento) => {
                    riferimentiCelleMese.current[i] = elemento;
                  }}
                  data-testid="selettore-mese-cella"
                  data-token={token}
                  aria-label={etichettaMese(token)}
                  aria-current={inGriglia ? "true" : undefined}
                  tabIndex={i === indiceMeseAttivo ? 0 : -1}
                  onClick={() => scegliMese(i)}
                  className={`relative flex h-9 cursor-pointer items-center justify-center rounded-[9px] border text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-200 dark:focus-visible:ring-rose-800 ${
                    inGriglia
                      ? "border-rose-600 bg-rose-600 text-white shadow-sm hover:bg-rose-700 hover:border-rose-700"
                      : "border-transparent bg-zinc-100 text-zinc-600 hover:bg-rose-50 hover:text-rose-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                  }`}
                >
                  {abbreviazione}
                  {isMeseOdierno && !inGriglia && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-[5px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-rose-600 dark:bg-rose-400"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-[9px] border-t border-zinc-100 pt-2 text-center text-[10.5px] font-semibold text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
            Frecce per spostarsi · Invio per scegliere · Esc per chiudere
          </div>
        </div>
      )}
    </div>
  );
}
