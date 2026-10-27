"use client";

import { useState } from "react";

interface ConsensoSimulatoProps {
  state: string;
  emailAccesso: string;
  percorsoCallback: string;
  prefissoCodice: string;
}

export default function ConsensoSimulato({
  state,
  emailAccesso,
  percorsoCallback,
  prefissoCodice,
}: ConsensoSimulatoProps) {
  const [altroAccount, setAltroAccount] = useState(false);
  const [altraEmail, setAltraEmail] = useState("");

  // Ritorno al callback come farebbe Google: codice simulato con l'account
  // autorizzato, oppure `error` quando il consenso è negato.
  function urlCallback(parametri: Record<string, string>): string {
    return `${percorsoCallback}?${new URLSearchParams({ ...parametri, state })}`;
  }

  return (
    <form
      className="mt-6 flex flex-col gap-3"
      onSubmit={(evento) => {
        evento.preventDefault();
        const email = altroAccount ? altraEmail.trim() : emailAccesso;
        window.location.assign(urlCallback({ code: `${prefissoCodice}${email}` }));
      }}
    >
      <fieldset className="flex flex-col gap-2 text-[13.5px] text-zinc-700 dark:text-zinc-200">
        <legend className="mb-1 font-semibold">Account da autorizzare</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="account"
            checked={!altroAccount}
            onChange={() => setAltroAccount(false)}
          />
          {emailAccesso} (account di accesso)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="account"
            checked={altroAccount}
            onChange={() => setAltroAccount(true)}
          />
          Un altro account
        </label>
        {altroAccount && (
          <input
            type="email"
            required
            aria-label="Email dell'altro account"
            value={altraEmail}
            onChange={(evento) => setAltraEmail(evento.target.value)}
            className="rounded-[10px] border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          />
        )}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="inline-flex items-center rounded-[10px] bg-indigo-600 px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-indigo-700"
        >
          Autorizza
        </button>
        <a
          href={urlCallback({ error: "access_denied" })}
          className="inline-flex items-center rounded-[10px] border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          Nega il consenso
        </a>
      </div>
    </form>
  );
}
