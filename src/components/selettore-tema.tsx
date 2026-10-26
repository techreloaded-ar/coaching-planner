"use client";

import { useEffect, useRef, useState } from "react";
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
 * Selettore discreto del tema: un pulsante-icona che mostra il tema attivo e
 * apre un piccolo pannello con Chiaro / Scuro / Browser. Applica subito il tema
 * impostando `data-tema` sull'elemento <html> (letto dalla variante `dark` in
 * globals.css) e lo ricorda nel cookie, che il layout radice rilegge al
 * rendering successivo. Il pannello si chiude dopo la scelta, con Esc o con un
 * click fuori.
 */
export function SelettoreTema({ temaIniziale }: { temaIniziale: Tema }) {
  const [temaAttivo, setTemaAttivo] = useState(temaIniziale);
  const [aperto, setAperto] = useState(false);
  const idratata = useIdratata();
  const riferimentoContenitore = useRef<HTMLDivElement>(null);
  const riferimentoPulsante = useRef<HTMLButtonElement>(null);
  const opzioneAttiva = OPZIONI_TEMA.find(({ tema }) => tema === temaAttivo)!;

  useEffect(() => {
    if (!aperto) return;
    function alTasto(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAperto(false);
        riferimentoPulsante.current?.focus();
      }
    }
    function alMouseDown(evento: MouseEvent) {
      if (!riferimentoContenitore.current?.contains(evento.target as Node)) {
        setAperto(false);
      }
    }
    document.addEventListener("keydown", alTasto);
    document.addEventListener("mousedown", alMouseDown);
    return () => {
      document.removeEventListener("keydown", alTasto);
      document.removeEventListener("mousedown", alMouseDown);
    };
  }, [aperto]);

  function scegliTema(tema: Tema) {
    applicaERicordaTema(tema);
    setTemaAttivo(tema);
    setAperto(false);
    riferimentoPulsante.current?.focus();
  }

  return (
    <div
      ref={riferimentoContenitore}
      data-testid="selettore-tema"
      data-idratata={idratata ? "true" : "false"}
      className="relative"
    >
      <button
        ref={riferimentoPulsante}
        type="button"
        aria-label="Tema"
        aria-expanded={aperto}
        aria-controls="pannello-tema"
        title={`Tema: ${opzioneAttiva.etichetta.toLowerCase()}`}
        onClick={() => setAperto((valore) => !valore)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 aria-expanded:bg-zinc-100 aria-expanded:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:aria-expanded:bg-zinc-800 dark:aria-expanded:text-zinc-100"
      >
        <IconaTema>{opzioneAttiva.icona}</IconaTema>
      </button>

      {aperto && (
        <div
          id="pannello-tema"
          role="group"
          aria-label="Scegli il tema"
          className="absolute right-0 top-full z-30 mt-1.5 flex w-36 flex-col gap-0.5 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          {OPZIONI_TEMA.map(({ tema, etichetta, icona }) => (
            <button
              key={tema}
              type="button"
              aria-pressed={temaAttivo === tema}
              autoFocus={temaAttivo === tema}
              onClick={() => scegliTema(tema)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-800 aria-pressed:bg-zinc-100 aria-pressed:font-semibold aria-pressed:text-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:aria-pressed:bg-zinc-700 dark:aria-pressed:text-zinc-100"
            >
              <IconaTema>{icona}</IconaTema>
              {etichetta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IconaTema({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </svg>
  );
}
