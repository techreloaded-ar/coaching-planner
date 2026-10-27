"use client";

import { useState } from "react";

interface UtenteSelezionabile {
  email: string;
  nomeCompleto: string;
  /** Ruolo ed eventuale profilo collaboratore, già in forma leggibile */
  profili: string;
}

export default function SceltaUtente({ utenti }: { utenti: UtenteSelezionabile[] }) {
  const [emailInAccesso, setEmailInAccesso] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  // Stesso meccanismo dei test e2e: /api/e2e-test/sessione crea la sessione
  // e indica la home autenticata.
  async function entraCome(email: string) {
    setEmailInAccesso(email);
    setErrore(null);
    const risposta = await fetch("/api/e2e-test/sessione", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const dati = (await risposta.json()) as { redirect?: string; error?: string };
    if (!risposta.ok || !dati.redirect) {
      setErrore(dati.error ?? "Accesso simulato non riuscito");
      setEmailInAccesso(null);
      return;
    }
    window.location.assign(dati.redirect);
  }

  return (
    <>
      {errore && (
        <p
          role="alert"
          className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
        >
          {errore}
        </p>
      )}
      <ul className="mt-6 flex flex-col gap-2">
        {utenti.map((utente) => (
          <li key={utente.email}>
            <button
              type="button"
              onClick={() => entraCome(utente.email)}
              disabled={emailInAccesso !== null}
              aria-busy={emailInAccesso === utente.email}
              className="flex w-full flex-col items-start rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-zinc-50 disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750"
            >
              <span className="text-[14.5px] font-semibold text-zinc-800 dark:text-zinc-100">
                {utente.nomeCompleto}
              </span>
              <span className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
                {utente.email} · {utente.profili}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
