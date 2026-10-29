"use client";

import { useState } from "react";
import {
  DURATA_COOKIE_TEMA_SECONDI,
  NOME_COOKIE_TEMA,
  type Tema,
} from "@/lib/tema";
import { useIdratata } from "./use-idratata";

const OPZIONI_TEMA: { tema: Tema; etichetta: string; icona: React.ReactNode }[] = [
  {
    tema: "chiaro",
    etichetta: "Chiaro",
    icona: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </>
    ),
  },
  { tema: "scuro", etichetta: "Scuro", icona: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /> },
  {
    tema: "browser",
    etichetta: "Browser",
    icona: (
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
  },
];

function applicaERicordaTema(tema: Tema) {
  document.documentElement.dataset.tema = tema;
  document.cookie = `${NOME_COOKIE_TEMA}=${tema}; path=/; max-age=${DURATA_COOKIE_TEMA_SECONDI}; samesite=lax`;
}

/**
 * Scelta del tema nella pagina Impostazioni: tre opzioni radio Chiaro / Scuro /
 * Browser. Applica subito il tema impostando `data-tema` sull'elemento <html>
 * (letto dalla variante `dark` in globals.css) e lo ricorda nel cookie, che il
 * layout radice rilegge al rendering successivo.
 */
export function SelettoreTema({ temaIniziale }: { temaIniziale: Tema }) {
  const [temaAttivo, setTemaAttivo] = useState(temaIniziale);
  const idratata = useIdratata();

  function scegliTema(tema: Tema) {
    applicaERicordaTema(tema);
    setTemaAttivo(tema);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      data-testid="selettore-tema"
      data-idratata={idratata ? "true" : "false"}
      className="flex flex-wrap gap-2"
    >
      {OPZIONI_TEMA.map(({ tema, etichetta, icona }) => (
        <label
          key={tema}
          className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-zinc-200 bg-white px-3.5 py-2 text-[13px] font-medium text-zinc-600 transition hover:bg-zinc-50 has-checked:border-indigo-500 has-checked:bg-indigo-50 has-checked:font-semibold has-checked:text-indigo-700 has-focus-visible:ring-2 has-focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:has-checked:border-indigo-400 dark:has-checked:bg-indigo-500/15 dark:has-checked:text-indigo-300"
        >
          <input
            type="radio"
            name="tema"
            value={tema}
            checked={temaAttivo === tema}
            onChange={() => scegliTema(tema)}
            className="sr-only"
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0"
          >
            {icona}
          </svg>
          {etichetta}
        </label>
      ))}
    </div>
  );
}
