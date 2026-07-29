"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useFormStatus } from "react-dom";

type ProprietaPulsanteAttesa = ComponentPropsWithoutRef<"button"> & {
  /** Etichetta mostrata al posto dei figli mentre l'invio è in corso (l'ellissi `…` è a carico del chiamante). */
  etichettaAttesa?: string;
  /** Mostra la rotellina a comparsa ritardata durante l'attesa. */
  mostraRotellina?: boolean;
  /**
   * Attesa comandata dal chiamante, per i flussi imperativi fuori da un `<form action=...>`.
   * Se valorizzata si somma allo stato del form, altrimenti comanda il solo `useFormStatus`.
   */
  attesaEsterna?: boolean;
};

/**
 * Pulsante condiviso con contratto di attesa uniforme: durante l'invio si
 * disabilita, espone `aria-busy="true"`, può scambiare l'etichetta e mostra una
 * rotellina che compare solo dopo 120ms, così le risposte rapide non producono
 * un flash. Dentro un `<form action=...>` lo stato arriva da `useFormStatus`;
 * fuori da un form `pending` è sempre `false` e comanda `attesaEsterna`.
 */
export function PulsanteAttesa({
  etichettaAttesa,
  mostraRotellina = true,
  attesaEsterna,
  type = "submit",
  disabled,
  className,
  children,
  ...proprietaNative
}: ProprietaPulsanteAttesa) {
  const { pending } = useFormStatus();
  const inAttesa = attesaEsterna === undefined ? pending : attesaEsterna || pending;

  return (
    <button
      {...proprietaNative}
      type={type}
      disabled={disabled || inAttesa}
      aria-busy={inAttesa}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`.trim()}
    >
      {mostraRotellina && inAttesa && (
        <span
          className="inline-flex animate-[comparsa-caricamento_200ms_ease-out_120ms_forwards] opacity-0"
          aria-hidden="true"
        >
          <span className="h-[13px] w-[13px] animate-spin rounded-full border-2 border-current/30 border-t-current" />
        </span>
      )}
      {inAttesa && etichettaAttesa ? etichettaAttesa : children}
    </button>
  );
}
