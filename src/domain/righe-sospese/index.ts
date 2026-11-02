// Righe del foglio di pianificazione che l'import Excel non ha potuto abbinare
// a collaboratore, cliente e offerta (vedi RigaAttivitaSospesa nello schema).

import type { MotivoSospensione } from "@/generated/prisma/client";

export type { MotivoSospensione };

/**
 * Descrizione leggibile di ogni motivo. Il tipo Record fa fallire la build se
 * un nuovo motivo dello schema resta senza descrizione.
 */
export const DESCRIZIONE_MOTIVO_SOSPENSIONE: Record<MotivoSospensione, string> = {
  COLLABORATORE_SCONOSCIUTO: "Collaboratore sconosciuto",
  CLIENTE_SCONOSCIUTO: "Cliente sconosciuto",
  OFFERTA_SCONOSCIUTA: "Offerta sconosciuta",
  OFFERTA_ALTRO_CLIENTE: "Offerta di un altro cliente",
  DATI_NON_VALIDI: "Dati non validi",
};

/** Motivi nell'ordine in cui l'import li verifica. */
export const MOTIVI_SOSPENSIONE = Object.keys(DESCRIZIONE_MOTIVO_SOSPENSIONE) as MotivoSospensione[];

export const STATI_RIGA_SOSPESA = ["aperte", "risolte", "tutte"] as const;

export type StatoRigaSospesa = (typeof STATI_RIGA_SOSPESA)[number];

const STATO_PREDEFINITO: StatoRigaSospesa = "aperte";

export interface FiltroRigheSospese {
  stato: StatoRigaSospesa;
  /** null = tutti i motivi. */
  motivo: MotivoSospensione | null;
}

function primoValore(valore?: string | string[] | null): string {
  return (Array.isArray(valore) ? valore[0] : valore) ?? "";
}

/**
 * Legge i parametri URL `stato` e `motivo`. Valori sconosciuti valgono come
 * assenti: righe aperte, tutti i motivi.
 */
export function leggiFiltroRigheSospese(parametri: {
  stato?: string | string[] | null;
  motivo?: string | string[] | null;
}): FiltroRigheSospese {
  const stato = primoValore(parametri.stato);
  const motivo = primoValore(parametri.motivo);
  return {
    stato: STATI_RIGA_SOSPESA.find((valore) => valore === stato) ?? STATO_PREDEFINITO,
    motivo: MOTIVI_SOSPENSIONE.find((valore) => valore === motivo) ?? null,
  };
}

/** Parametri URL del filtro, senza i valori predefiniti. */
export function parametriFiltroRigheSospese({ stato, motivo }: FiltroRigheSospese): Record<string, string> {
  return {
    ...(stato !== STATO_PREDEFINITO ? { stato } : {}),
    ...(motivo ? { motivo } : {}),
  };
}
