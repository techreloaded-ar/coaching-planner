// Sidebar collassata ricordata sul browser tramite cookie, così il server la
// disegna già nello stato giusto. Modulo puro: usato da server e client.

export const NOME_COOKIE_SIDEBAR_COMPRESSA = "sidebar-compressa";

/** Un anno: la scelta resta finché l'utente non la cambia. */
export const DURATA_COOKIE_SIDEBAR_COMPRESSA_SECONDI = 60 * 60 * 24 * 365;
