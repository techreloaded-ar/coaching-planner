// Dominio Calendario Mensile — funzioni pure
// Settimana lunedì-prima, locale IT, giorni fuori mese marcati.
// Nessuna dipendenza dal framework.

// ── Tipi ────────────────────────────────────────────────────────

export interface CellaGiorno {
  /** Data effettiva del giorno */
  data: Date;
  /** true se il giorno appartiene al mese precedente o successivo */
  fuoriMese: boolean;
  /** true se sabato o domenica */
  isWeekend: boolean;
}

export interface TokenMese {
  anno: number;
  mese: number;
}

// ── Costanti ────────────────────────────────────────────────────

/** Formattatore mese/anno in italiano */
const formattatoreMese = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
});

/** Giorni della settimana: lunedì = 0, domenica = 6 (ISO) */
function isoWeekday(d: Date): number {
  // getDay() restituisce 0=domenica, 1=lunedì, ..., 6=sabato
  // Convertiamo a ISO: lunedì=0, ..., domenica=6
  const jsDay = d.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

// ── Token mese corrente ─────────────────────────────────────────

/**
 * Restituisce il token YYYY-MM del mese corrente.
 */
export function tokenMeseCorrente(): string {
  const oggi = new Date();
  return formattaTokenMese(oggi.getFullYear(), oggi.getMonth() + 1);
}

// ── Parsing e formattazione token ───────────────────────────────

/**
 * Parsa un token "YYYY-MM" restituendo anno e mese.
 * Restituisce null se il formato non è valido.
 */
export function parseTokenMese(token: string): TokenMese | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(token);
  if (!match) return null;
  return {
    anno: parseInt(match[1], 10),
    mese: parseInt(match[2], 10),
  };
}

/**
 * Formatta anno e mese in token "YYYY-MM".
 * Il mese viene normalizzato: 13 → anno successivo, mese 1; 0 → anno precedente, mese 12.
 */
export function formattaTokenMese(anno: number, mese: number): string {
  // Normalizza il mese
  let a = anno;
  let m = mese;
  while (m > 12) {
    m -= 12;
    a += 1;
  }
  while (m < 1) {
    m += 12;
    a -= 1;
  }
  const mm = String(m).padStart(2, "0");
  return `${a}-${mm}`;
}

/**
 * Restituisce l'etichetta del mese in italiano (es. "Giugno 2026").
 */
export function etichettaMese(token: string): string {
  const parsed = parseTokenMese(token);
  if (!parsed) return token; // fallback
  const data = new Date(parsed.anno, parsed.mese - 1, 1);
  return formattatoreMese.format(data);
}

// ── Navigazione mese ────────────────────────────────────────────

/**
 * Restituisce il token YYYY-MM del mese precedente.
 */
export function mesePrecedente(token: string): string {
  const parsed = parseTokenMese(token);
  if (!parsed) return token;
  const nuovoMese = parsed.mese - 1;
  if (nuovoMese >= 1) {
    return formattaTokenMese(parsed.anno, nuovoMese);
  }
  // Dicembre dell'anno precedente
  return formattaTokenMese(parsed.anno - 1, 12);
}

/**
 * Restituisce il token YYYY-MM del mese successivo.
 */
export function meseSuccessivo(token: string): string {
  const parsed = parseTokenMese(token);
  if (!parsed) return token;
  const nuovoMese = parsed.mese + 1;
  if (nuovoMese <= 12) {
    return formattaTokenMese(parsed.anno, nuovoMese);
  }
  // Gennaio dell'anno successivo
  return formattaTokenMese(parsed.anno + 1, 1);
}

// ── Griglia mese ────────────────────────────────────────────────

/**
 * Costruisce la griglia del mese come array di CellaGiorno.
 *
 * Regole:
 * - La griglia inizia sempre di lunedì
 * - I giorni prima del 1° del mese e dopo l'ultimo sono marcati `fuoriMese: true`
 * - Le settimane sono sempre complete (7 giorni)
 * - Il numero di righe è il minimo necessario per coprire tutti i giorni del mese
 *
 * @param token - Token YYYY-MM del mese da visualizzare
 * @returns Array di CellaGiorno che rappresenta la griglia completa
 */
export function costruisciGrigliaMese(token: string): CellaGiorno[] {
  const parsed = parseTokenMese(token);
  if (!parsed) return [];

  const { anno, mese } = parsed;

  // Primo giorno del mese (Date usa mese 0-based)
  const primoDelMese = new Date(anno, mese - 1, 1);
  // Ultimo giorno del mese
  const ultimoDelMese = new Date(anno, mese, 0);
  const giorniNelMese = ultimoDelMese.getDate();

  // Giorno della settimana del primo del mese (ISO: lun=0, dom=6)
  const primoGiornoSettimana = isoWeekday(primoDelMese);
  // Giorno della settimana dell'ultimo del mese
  const ultimoGiornoSettimana = isoWeekday(ultimoDelMese);

  // Quanti giorni del mese precedente servono per riempire l'inizio
  const giorniPrecedenti = primoGiornoSettimana;
  // Quanti giorni del mese successivo servono per completare l'ultima settimana
  const giorniSuccessivi = 6 - ultimoGiornoSettimana;

  const griglia: CellaGiorno[] = [];

  // Giorni del mese precedente
  for (let i = giorniPrecedenti; i > 0; i--) {
    const data = new Date(anno, mese - 1, 1 - i);
    const jsDay = data.getDay();
    const isWeekend = jsDay === 0 || jsDay === 6;
    griglia.push({ data, fuoriMese: true, isWeekend });
  }

  // Giorni del mese corrente
  for (let g = 1; g <= giorniNelMese; g++) {
    const data = new Date(anno, mese - 1, g);
    const jsDay = data.getDay();
    const isWeekend = jsDay === 0 || jsDay === 6;
    griglia.push({ data, fuoriMese: false, isWeekend });
  }

  // Giorni del mese successivo
  for (let i = 1; i <= giorniSuccessivi; i++) {
    const data = new Date(anno, mese, i);
    const jsDay = data.getDay();
    const isWeekend = jsDay === 0 || jsDay === 6;
    griglia.push({ data, fuoriMese: true, isWeekend });
  }

  return griglia;
}
