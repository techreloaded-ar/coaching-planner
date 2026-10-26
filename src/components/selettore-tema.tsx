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
  {
    tema: "scuro",
    etichetta: "Scuro",
    icona: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  },
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
 * Selettore Chiaro / Scuro / Browser. Applica subito il tema impostando
 * `data-tema` sull'elemento <html> (letto dalla variante `dark` in globals.css)
 * e lo ricorda nel cookie, che il layout radice rilegge al rendering successivo.
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
      role="group"
      aria-label="Tema"
      data-idratata={idratata ? "true" : "false"}
      className="inline-flex items-center gap-0.5 rounded-[10px] border border-zinc-200 bg-white p-0.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
    >
      {OPZIONI_TEMA.map(({ tema, etichetta, icona }) => (
        <button
          key={tema}
          type="button"
          aria-pressed={temaAttivo === tema}
          title={`Tema ${etichetta.toLowerCase()}`}
          onClick={() => scegliTema(tema)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-zinc-500 transition hover:text-zinc-800 aria-pressed:bg-zinc-100 aria-pressed:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:aria-pressed:bg-zinc-700 dark:aria-pressed:text-zinc-100"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            {icona}
          </svg>
          {etichetta}
        </button>
      ))}
    </div>
  );
}
