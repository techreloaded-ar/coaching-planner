// Catalogo dei permessi e mappa ruolo → permessi.
// Modulo puro di dominio: nessuna dipendenza da framework, database o cookie.
// Per introdurre un ruolo nuovo basta aggiungere la sua riga a PERMESSI_PER_RUOLO.

import type { Ruolo } from "@/domain/types";

/** Permessi nominati, in ordine di presentazione */
export const PERMESSI = [
  /** Gestire le offerte */
  "GESTIRE_OFFERTE",
  /** Gestire abilitazioni e ingaggi */
  "GESTIRE_ABILITAZIONI",
  /** Gestire i clienti */
  "GESTIRE_CLIENTI",
  /** Gestire collaboratori e tariffe */
  "GESTIRE_COLLABORATORI",
  /** Gestire gli utenti */
  "GESTIRE_UTENTI",
  /** Gestire le voci di rimborso */
  "GESTIRE_VOCI_RIMBORSO",
  /** Gestire le righe sospese */
  "GESTIRE_RIGHE_SOSPESE",
  /** Gestire l'importazione dei dati */
  "GESTIRE_IMPORTAZIONE",
  /** Consultare il report di fatturazione ai clienti */
  "CONSULTARE_REPORT_FATTURAZIONE_CLIENTI",
  /** Consultare il report di fatturazione dei collaboratori */
  "CONSULTARE_REPORT_FATTURAZIONE_COLLABORATORI",
  /** Consultare il report di marginalità */
  "CONSULTARE_REPORT_MARGINALITA",
  /** Consultare i fogli attività degli altri collaboratori */
  "CONSULTARE_FOGLI_ATTIVITA_ALTRUI",
] as const;

export type Permesso = (typeof PERMESSI)[number];

/** Permessi che aprono il back office: tutti tranne quelli del solo front office. */
export const PERMESSI_BACK_OFFICE: readonly Permesso[] = PERMESSI.filter(
  (permesso) => permesso !== "CONSULTARE_FOGLI_ATTIVITA_ALTRUI"
);

/** Vero se l'insieme contiene almeno un permesso di back office. */
export function haAccessoBackOffice(permessi: readonly Permesso[]): boolean {
  return permessi.some((permesso) => PERMESSI_BACK_OFFICE.includes(permesso));
}

/**
 * Unica mappa ruolo → permessi. «Consuntivare» non è un permesso: deriva dal
 * profilo Collaboratore attivo, per questo COLLABORATORE non ne ha.
 */
export const PERMESSI_PER_RUOLO: Record<Ruolo, readonly Permesso[]> = {
  AMMINISTRATORE: PERMESSI,
  COLLABORATORE: [],
};

/** Permessi concessi al ruolo indicato. */
export function permessiDelRuolo(ruolo: Ruolo): readonly Permesso[] {
  return PERMESSI_PER_RUOLO[ruolo];
}
