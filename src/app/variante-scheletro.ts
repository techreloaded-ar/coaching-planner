// Quale scheletro mostrare mentre una pagina si carica, deciso dall'indirizzo
// di destinazione. Modulo puro: nessuna dipendenza da React o Next.
//
// Lo scheletro compare al clic su una voce del menu, prima che la pagina di
// arrivo sia disponibile: dipende solo dall'indirizzo di destinazione.

export type VarianteScheletro =
  | "calendario"
  | "elenco-attivita"
  | "giornata"
  | "riepilogo"
  | "elenco"
  | "report"
  | "importazione"
  | "dettaglio";

/** Elenchi con card tabella; comprende gli indirizzi che reindirizzano a un elenco. */
const PERCORSI_ELENCO: ReadonlySet<string> = new Set([
  "/anagrafiche",
  "/anagrafiche/clienti",
  "/anagrafiche/persone",
  "/anagrafiche/utenti",
  "/anagrafiche/collaboratori",
  "/anagrafiche/voci-rimborso",
  "/offerte",
  "/righe-sospese",
  "/report/avanzamento-offerte",
]);

const PERCORSI_REPORT: ReadonlySet<string> = new Set([
  "/report/fatturazione-clienti",
  "/report/fatturazione-collaboratori",
  "/report/marginalita",
]);

const GIORNATA = /^\/attivita\/\d{4}-\d{2}-\d{2}$/;

/**
 * Variante dello scheletro per la pagina `pathname`; `vista` è il parametro
 * `?vista=` del registro attività (calendario predefinito, oppure elenco).
 */
export function varianteScheletro(pathname: string, vista: string | null): VarianteScheletro {
  const percorso = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (percorso === "/attivita") return vista === "elenco" ? "elenco-attivita" : "calendario";
  if (percorso === "/attivita/riepilogo") return "riepilogo";
  if (GIORNATA.test(percorso)) return "giornata";
  // Una data non valida riporta al calendario.
  if (percorso.startsWith("/attivita/")) return "calendario";

  if (PERCORSI_ELENCO.has(percorso)) return "elenco";
  if (PERCORSI_REPORT.has(percorso)) return "report";
  if (percorso === "/importazione") return "importazione";
  return "dettaglio";
}
