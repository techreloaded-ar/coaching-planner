"use client";

import { useState } from "react";
import { abilitaCollaboratoreSuOfferta } from "@/lib/actions/abilitazioni-offerte";
import { PulsanteAttesa } from "./pulsante-attesa";

/** Classi gialle di una riga su un'offerta a cui il collaboratore non è abilitato. */
export const CLASSE_RIGA_OFFERTA_NON_ABILITATA =
  "bg-amber-50 shadow-[inset_4px_0_0] shadow-amber-500 dark:bg-amber-950/30 dark:shadow-amber-400";

/** Triangolo di avviso delle offerte non abilitate. */
export function IconaOffertaNonAbilitata({ className = "h-[13px] w-[13px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className={`shrink-0 ${className}`} aria-hidden="true">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

interface AbilitazioneProps {
  collaboratoreId: string;
  offertaId: string;
  nomeCollaboratore: string;
  /** Chiamata dopo l'abilitazione riuscita, per rileggere i dati mostrati. */
  onAbilitata: () => void | Promise<void>;
}

/**
 * Pulsante «Abilita» dell'amministratore con conferma in linea, come
 * l'eliminazione delle righe: abilita il collaboratore all'offerta.
 */
export function PulsanteAbilitaOfferta({ collaboratoreId, offertaId, nomeCollaboratore, onAbilitata }: AbilitazioneProps) {
  const [inConferma, setInConferma] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const abilita = async () => {
    setInCorso(true);
    setErrore(null);
    try {
      const esito = await abilitaCollaboratoreSuOfferta(collaboratoreId, offertaId);
      if (!esito.success) {
        setErrore(esito.error ?? "Abilitazione non riuscita.");
        return;
      }
      setInConferma(false);
      await onAbilitata();
    } finally {
      setInCorso(false);
    }
  };

  const classePulsante =
    "inline-flex h-7 cursor-pointer items-center rounded-[8px] px-2.5 text-xs font-medium transition";

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {errore && <span role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">{errore}</span>}
      {inConferma ? (
        <>
          <span>Abilitare {nomeCollaboratore} a questa offerta?</span>
          <button
            type="button"
            onClick={() => setInConferma(false)}
            className={`${classePulsante} border border-zinc-200 bg-white text-testo-secondario hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800`}
          >
            No
          </button>
          <PulsanteAttesa
            type="button"
            attesaEsterna={inCorso}
            etichettaAttesa="Abilito…"
            onClick={() => void abilita()}
            className={`${classePulsante} gap-1.5 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-zinc-900`}
          >
            Abilita
          </PulsanteAttesa>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setInConferma(true)}
          className={`${classePulsante} border border-amber-500 bg-white text-amber-700 hover:bg-amber-50 dark:bg-zinc-900 dark:text-amber-300`}
        >
          Abilita
        </button>
      )}
    </span>
  );
}

/**
 * Striscia sotto una riga del foglio attività su un'offerta a cui il
 * collaboratore non è abilitato. Il pulsante c'è solo se `abilitazione` è
 * indicata: amministratore sul foglio di un collaboratore attivo, offerta attiva.
 */
export function AvvisoOffertaNonAbilitata({
  codiceOfferta,
  nomeCollaboratore,
  abilitazione,
}: {
  codiceOfferta: string;
  /** `null` sul proprio foglio: il messaggio è in seconda persona. */
  nomeCollaboratore: string | null;
  abilitazione?: Omit<AbilitazioneProps, "nomeCollaboratore"> | null;
}) {
  return (
    <div
      data-testid="avviso-offerta-non-abilitata"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-amber-800 dark:text-amber-300"
    >
      <span className="inline-flex items-center gap-1.5">
        <IconaOffertaNonAbilitata />
        {nomeCollaboratore
          ? `${nomeCollaboratore} non è abilitato all'offerta ${codiceOfferta}.`
          : `Non sei abilitato all'offerta ${codiceOfferta}.`}
      </span>
      {abilitazione && nomeCollaboratore && (
        <span className="ml-auto">
          <PulsanteAbilitaOfferta {...abilitazione} nomeCollaboratore={nomeCollaboratore} />
        </span>
      )}
    </div>
  );
}
