// Preferenza di tema dell'interfaccia, ricordata sul browser tramite cookie.
// Modulo puro: usato sia dal server (lettura del cookie) sia dal selettore client.

export const TEMI = ["chiaro", "scuro", "browser"] as const;

export type Tema = (typeof TEMI)[number];

export const NOME_COOKIE_TEMA = "tema";

export const TEMA_PREDEFINITO: Tema = "browser";

/** Un anno: la scelta resta finché l'utente non la cambia. */
export const DURATA_COOKIE_TEMA_SECONDI = 60 * 60 * 24 * 365;

/** Il cookie arriva dal client: qualsiasi valore non riconosciuto torna al predefinito. */
export function normalizzaTema(valore: string | undefined): Tema {
  return TEMI.find((tema) => tema === valore) ?? TEMA_PREDEFINITO;
}
