/**
 * URL del foglio attività consultato da un amministratore.
 *
 * Modulo puro, importabile da server e client: il collaboratore consultato
 * viaggia nell'URL come parametro di query, così il link è condivisibile e non
 * esiste alcuno stato nascosto in sessione. Il parametro è solo una richiesta:
 * l'autorizzazione resta sempre al server (`@/lib/foglio-attivita`).
 */

/** Parametro di query che indica il collaboratore di cui si consulta il foglio. */
export const PARAMETRO_COLLABORATORE_CONSULTATO = "collaboratore";

/**
 * Aggiunge all'URL dell'area attività il collaboratore consultato.
 *
 * Senza collaboratore consultato l'URL resta quello del proprio foglio.
 */
export function urlDelFoglio(
  url: string,
  collaboratoreConsultatoId: string | null | undefined
): string {
  if (!collaboratoreConsultatoId) return url;

  const separatore = url.includes("?") ? "&" : "?";
  return `${url}${separatore}${PARAMETRO_COLLABORATORE_CONSULTATO}=${encodeURIComponent(collaboratoreConsultatoId)}`;
}
