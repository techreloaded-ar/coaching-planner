"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ELEMENTI_PER_PAGINA,
  inizioPagina,
  numeriPagineVisibili,
  urlPosizioneElenco,
  type PaginaElenco,
  type PosizioneElenco,
} from "@/lib/paginazione";

const ATTESA_RICERCA_MS = 300;

/**
 * Campo di ricerca di un elenco paginato: la ricerca avviene sul server.
 * Dopo una breve pausa di digitazione aggiorna `q` nell'URL (con `replace`,
 * per non riempire la cronologia) e riporta alla prima pagina.
 */
export function RicercaElenco({
  ricerca,
  segnaposto,
  etichetta,
  className = "",
}: {
  ricerca: string;
  segnaposto: string;
  etichetta: string;
  className?: string;
}) {
  const router = useRouter();
  const percorso = usePathname();
  const [testo, setTesto] = useState(ricerca);
  const [ricercaOsservata, setRicercaOsservata] = useState(ricerca);
  const [ultimaRicercaInviata, setUltimaRicercaInviata] = useState(ricerca);
  const timerRicerca = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Indietro o un link possono cambiare `q` senza rimontare il componente:
  // il campo si riallinea all'URL, salvo quando è l'eco della ricerca appena
  // inviata (l'utente potrebbe aver già digitato altro nel frattempo).
  if (ricerca !== ricercaOsservata) {
    setRicercaOsservata(ricerca);
    if (ricerca !== ultimaRicercaInviata) {
      setTesto(ricerca);
    }
  }

  useEffect(() => () => clearTimeout(timerRicerca.current), []);

  function cambiaTesto(valore: string) {
    setTesto(valore);
    clearTimeout(timerRicerca.current);
    timerRicerca.current = setTimeout(() => {
      setUltimaRicercaInviata(valore.trim());
      router.replace(
        urlPosizioneElenco(percorso, { ricerca: valore.trim(), pagina: 1 }),
        { scroll: false },
      );
    }, ATTESA_RICERCA_MS);
  }

  return (
    <label
      className={`flex flex-1 items-center gap-2 rounded-[10px] border border-zinc-200 bg-zinc-100 px-3 py-2 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px] shrink-0" strokeWidth={2}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.3-3.3" />
      </svg>
      <input
        type="search"
        placeholder={segnaposto}
        value={testo}
        onChange={(e) => cambiaTesto(e.target.value)}
        className="w-full border-0 bg-transparent font-[inherit] text-[13.5px] text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
        aria-label={etichetta}
      />
    </label>
  );
}

/**
 * Campi nascosti che trasmettono a una server action la posizione corrente
 * nell'elenco, così il redirect successivo riporta alla stessa pagina e ricerca.
 */
export function CampiPosizioneElenco({ ricerca, pagina }: PosizioneElenco) {
  return (
    <>
      <input type="hidden" name="q" value={ricerca} />
      <input type="hidden" name="pagina" value={pagina} />
    </>
  );
}

const classeControllo =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] px-[10px] text-[12.5px] font-semibold no-underline transition";
const classeControlloAttivo = `${classeControllo} text-zinc-600 hover:bg-indigo-50 hover:text-indigo-600 dark:text-zinc-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400`;
const classeControlloDisabilitato = `${classeControllo} cursor-default text-zinc-300 dark:text-zinc-600`;

/**
 * Piede di un elenco paginato: «Mostrati X–Y di N» e, con più di una pagina,
 * i controlli Precedente / numeri di pagina / Successiva.
 */
export function PaginazioneElenco({
  percorso,
  ricerca,
  paginaCorrente,
  totalePagine,
  totaleElementi,
}: PaginaElenco & { percorso: string; ricerca: string }) {
  if (totaleElementi === 0) {
    return null;
  }

  const primo = inizioPagina(paginaCorrente) + 1;
  const ultimo = Math.min(paginaCorrente * ELEMENTI_PER_PAGINA, totaleElementi);
  const urlPagina = (pagina: number) =>
    urlPosizioneElenco(percorso, { ricerca, pagina });

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 px-4 py-[12px] dark:border-zinc-800">
      <span className="text-[12.5px] font-medium text-zinc-400 tabular-nums dark:text-zinc-500">
        Mostrati {primo}–{ultimo} di {totaleElementi}
      </span>
      {totalePagine > 1 && (
        <nav aria-label="Paginazione" className="ml-auto flex items-center gap-[2px]">
          {paginaCorrente > 1 ? (
            <Link href={urlPagina(paginaCorrente - 1)} className={classeControlloAttivo}>
              Precedente
            </Link>
          ) : (
            <span aria-disabled="true" className={classeControlloDisabilitato}>
              Precedente
            </span>
          )}
          {numeriPagineVisibili(paginaCorrente, totalePagine).map((numero, indice) =>
            numero === "…" ? (
              <span key={`salto-${indice}`} className="px-1 text-[12.5px] text-zinc-400" aria-hidden="true">
                …
              </span>
            ) : numero === paginaCorrente ? (
              <span
                key={numero}
                aria-current="page"
                aria-label={`Pagina ${numero}`}
                className={`${classeControllo} bg-indigo-500 text-white tabular-nums`}
              >
                {numero}
              </span>
            ) : (
              <Link
                key={numero}
                href={urlPagina(numero)}
                aria-label={`Pagina ${numero}`}
                className={`${classeControlloAttivo} tabular-nums`}
              >
                {numero}
              </Link>
            ),
          )}
          {paginaCorrente < totalePagine ? (
            <Link href={urlPagina(paginaCorrente + 1)} className={classeControlloAttivo}>
              Successiva
            </Link>
          ) : (
            <span aria-disabled="true" className={classeControlloDisabilitato}>
              Successiva
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
