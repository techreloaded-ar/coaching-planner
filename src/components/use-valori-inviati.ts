"use client";

import { useState } from "react";

/** Estrae dal FormData i soli campi testuali, per ripopolare i defaultValue. */
function memorizzaValoriTestuali(datiForm: FormData): Record<string, string> {
  const valoriTestuali: Record<string, string> = {};
  for (const [nomeCampo, valore] of datiForm.entries()) {
    if (typeof valore === "string") valoriTestuali[nomeCampo] = valore;
  }
  return valoriTestuali;
}

export interface MemoriaValoriInviati {
  /** Va passata a `<form action=...>` al posto dell'action grezza. */
  azioneConMemoria: (datiForm: FormData) => void;
  /** `defaultValue` del campo: il valore dell'ultimo invio, altrimenti l'originale. */
  valoreIniziale: (nomeCampo: string, valoreOriginale: string) => string;
}

/**
 * Conserva i valori testuali dell'ultimo invio per ripopolare i `defaultValue`
 * di un form non controllato: React 19 azzera i campi non controllati prima di
 * ogni form action, quindi dopo un invio fallito l'utente si ritroverebbe il
 * form vuoto.
 *
 * I campi devono restare **non controllati** (`defaultValue`, mai
 * `value`+`onChange`): con campi controllati quanto l'utente digita prima
 * dell'idratazione verrebbe cancellato al primo render client.
 *
 * `alMemorizzare` serve ai form che devono risincronizzare uno stato derivato
 * dai valori inviati, come l'anteprima della fascia in `scaglione-form`.
 */
export function useValoriInviati(
  azione: (datiForm: FormData) => void,
  alMemorizzare?: (valoriTestuali: Record<string, string>) => void,
): MemoriaValoriInviati {
  const [valoriInviati, setValoriInviati] = useState<Record<string, string> | null>(
    null,
  );

  function azioneConMemoria(datiForm: FormData) {
    const valoriTestuali = memorizzaValoriTestuali(datiForm);
    setValoriInviati(valoriTestuali);
    alMemorizzare?.(valoriTestuali);
    return azione(datiForm);
  }

  function valoreIniziale(nomeCampo: string, valoreOriginale: string) {
    return valoriInviati?.[nomeCampo] ?? valoreOriginale;
  }

  return { azioneConMemoria, valoreIniziale };
}
