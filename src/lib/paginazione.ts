// Regole condivise di paginazione degli elenchi del back-office (clienti,
// offerte). Funzioni pure: utilizzabili da server, client e test.

export const ELEMENTI_PER_PAGINA = 50;

/** Posizione nell'elenco espressa dai parametri URL `q` e `pagina`. */
export interface PosizioneElenco {
  ricerca: string;
  pagina: number;
}

/** Esito di una lettura paginata: la pagina effettivamente mostrata e i totali. */
export interface PaginaElenco {
  paginaCorrente: number;
  totalePagine: number;
  totaleElementi: number;
}

function primoValore(valore?: string | string[] | null): string {
  return (Array.isArray(valore) ? valore[0] : valore) ?? "";
}

/**
 * Legge ricerca e pagina dai parametri grezzi (searchParams o FormData).
 * Una pagina mancante o non valida vale 1.
 */
export function leggiPosizioneElenco(parametri: {
  q?: string | string[] | null;
  pagina?: string | string[] | null;
}): PosizioneElenco {
  const pagina = Number.parseInt(primoValore(parametri.pagina), 10);
  return {
    ricerca: primoValore(parametri.q).trim(),
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** Legge la posizione nell'elenco dai campi nascosti `q`/`pagina` di un form. */
export function leggiPosizioneElencoDaForm(formData: FormData): PosizioneElenco {
  const valore = (nome: string) => {
    const campo = formData.get(nome);
    return typeof campo === "string" ? campo : null;
  };
  return leggiPosizioneElenco({ q: valore("q"), pagina: valore("pagina") });
}

/**
 * Riduce la pagina richiesta all'intervallo valido: oltre l'ultima pagina si
 * mostra l'ultima; un elenco vuoto ha comunque una pagina.
 */
export function calcolaPaginaElenco(
  paginaRichiesta: number,
  totaleElementi: number,
): PaginaElenco {
  const totalePagine = Math.max(1, Math.ceil(totaleElementi / ELEMENTI_PER_PAGINA));
  return {
    paginaCorrente: Math.min(Math.max(1, paginaRichiesta), totalePagine),
    totalePagine,
    totaleElementi,
  };
}

/** Indice del primo elemento della pagina, per `skip`/`slice`. */
export function inizioPagina(paginaCorrente: number): number {
  return (paginaCorrente - 1) * ELEMENTI_PER_PAGINA;
}

/**
 * Aggiunge `q` e `pagina` ai parametri, omettendo i valori di default
 * (ricerca vuota, pagina 1) per mantenere gli URL puliti.
 */
export function aggiungiPosizioneElenco(
  parametri: URLSearchParams,
  { ricerca, pagina }: PosizioneElenco,
): URLSearchParams {
  if (ricerca) parametri.set("q", ricerca);
  if (pagina > 1) parametri.set("pagina", String(pagina));
  return parametri;
}

/** URL di una posizione dell'elenco su `percorso`. */
export function urlPosizioneElenco(
  percorso: string,
  posizione: PosizioneElenco,
  altriParametri: Record<string, string> = {},
): string {
  const parametri = aggiungiPosizioneElenco(
    new URLSearchParams(altriParametri),
    posizione,
  );
  const query = parametri.toString();
  return query ? `${percorso}?${query}` : percorso;
}

/**
 * Numeri di pagina da mostrare nei controlli: prima, ultima, la corrente e le
 * due adiacenti; i salti sono rappresentati da "…".
 */
export function numeriPagineVisibili(
  paginaCorrente: number,
  totalePagine: number,
): (number | "…")[] {
  const numeri: (number | "…")[] = [];
  for (let numero = 1; numero <= totalePagine; numero++) {
    const visibile =
      numero === 1 ||
      numero === totalePagine ||
      Math.abs(numero - paginaCorrente) <= 1;
    if (visibile) {
      numeri.push(numero);
    } else if (numeri[numeri.length - 1] !== "…") {
      numeri.push("…");
    }
  }
  return numeri;
}
