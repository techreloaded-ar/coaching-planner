"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PulsanteAttesa } from "./pulsante-attesa";
import { useIdratata } from "./use-idratata";

interface MenuAccountProps {
  nome: string;
  email: string;
  ruolo: "Amministratore" | "Collaboratore";
  /** Server Action di logout, passata dal layout server */
  azioneEsci: () => Promise<void>;
}

function inizialiDi(nome: string): string {
  return nome
    .split(" ")
    .map((parola) => parola[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Account dell'utente collegato nell'intestazione: solo l'avatar con le
 * iniziali, che apre un pannello con nome, email e ruolo, la voce
 * «Impostazioni» e «Esci». Il pannello si chiude con Esc, con un click fuori o
 * con un nuovo click sull'avatar.
 */
export function MenuAccount({ nome, email, ruolo, azioneEsci }: MenuAccountProps) {
  const [aperto, setAperto] = useState(false);
  const idratata = useIdratata();
  const riferimentoContenitore = useRef<HTMLDivElement>(null);
  const riferimentoPulsante = useRef<HTMLButtonElement>(null);
  const iniziali = inizialiDi(nome);
  const coloreAvatar = ruolo === "Amministratore" ? "bg-indigo-600" : "bg-rose-600";

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

  return (
    <div
      ref={riferimentoContenitore}
      data-testid="menu-account"
      data-idratata={idratata ? "true" : "false"}
      className="relative"
    >
      <button
        ref={riferimentoPulsante}
        type="button"
        aria-label="Menu dell'account"
        aria-expanded={aperto}
        aria-controls="pannello-account"
        title={nome}
        onClick={() => setAperto((valore) => !valore)}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white ring-offset-2 transition hover:ring-2 hover:ring-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 aria-expanded:ring-2 aria-expanded:ring-zinc-300 dark:ring-offset-zinc-950 dark:hover:ring-zinc-600 dark:aria-expanded:ring-zinc-600 ${coloreAvatar}`}
      >
        {iniziali}
      </button>

      {aperto && (
        <div
          id="pannello-account"
          role="group"
          aria-label="Account"
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div
              aria-hidden="true"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white ${coloreAvatar}`}
            >
              {iniziali}
            </div>
            <div className="min-w-0 leading-tight">
              <b className="block truncate text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-100">
                {nome}
              </b>
              <span className="block truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                {email}
              </span>
              <span className="block text-[11.5px] text-zinc-400 dark:text-zinc-500">
                {ruolo}
              </span>
            </div>
          </div>
          <div role="separator" className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          <Link
            href="/impostazioni/tema"
            onClick={() => setAperto(false)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
            Impostazioni
          </Link>
          <form action={azioneEsci}>
            <PulsanteAttesa
              data-esci
              etichettaAttesa="Uscita…"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0">
                <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
                <path d="m16 17 5-5-5-5M21 12H9" />
              </svg>
              Esci
            </PulsanteAttesa>
          </form>
        </div>
      )}
    </div>
  );
}
