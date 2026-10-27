// Dominio Proposte dal calendario Google — funzioni pure
// Trasforma gli eventi del calendario principale del collaboratore nelle
// proposte di ore di una giornata. Nessuna dipendenza dal framework.

// ── Tipi ────────────────────────────────────────────────────────

/** Sottoinsieme della risorsa `Event` della Google Calendar API v3 usato qui. */
export interface EventoGoogle {
  id: string;
  status?: string;
  /** `default`, `outOfOffice`, `focusTime`, `workingLocation`, … */
  eventType?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; self?: boolean; responseStatus?: string }[];
}

/** Impegno del giorno proposto come riga attività, prima dell'associazione. */
export interface PropostaEvento {
  eventoId: string;
  titolo: string;
  descrizione: string;
  /** Orario di inizio `HH:MM` nel fuso della giornata */
  inizio: string;
  /** Orario di fine `HH:MM` nel fuso della giornata */
  fine: string;
  ore: number;
  /** Domini email degli altri partecipanti, senza duplicati (mai gli indirizzi) */
  dominiPartecipanti: string[];
}

// ── Costanti ────────────────────────────────────────────────────

/** Fuso civile in cui il collaboratore consuntiva le proprie giornate. */
export const FUSO_GIORNATA = "Europe/Rome";

export const TITOLO_EVENTO_SENZA_TITOLO = "(Senza titolo)";

const ORE_MASSIME_RIGA = 24;

const formattatoreGiorno = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_GIORNATA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formattatoreOrario = new Intl.DateTimeFormat("it-IT", {
  timeZone: FUSO_GIORNATA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// ── Funzioni ────────────────────────────────────────────────────

/**
 * Finestra UTC da chiedere alla Calendar API per una giornata `YYYY-MM-DD`.
 *
 * È volutamente più ampia del giorno civile (±12 ore attorno ai suoi estremi
 * UTC): l'appartenenza esatta al giorno è decisa da `proposteDaEventi` con il
 * fuso della giornata, così non serve calcolare l'offset dell'ora legale.
 */
export function finestraRichiestaGiorno(giorno: string): {
  timeMin: string;
  timeMax: string;
} {
  const [anno, mese, g] = giorno.split("-").map(Number);
  const mezzanotteUtc = Date.UTC(anno, mese - 1, g);
  const dodiciOre = 12 * 60 * 60 * 1000;
  return {
    timeMin: new Date(mezzanotteUtc - dodiciOre).toISOString(),
    timeMax: new Date(mezzanotteUtc + 24 * 60 * 60 * 1000 + dodiciOre).toISOString(),
  };
}

/** Durata in ore arrotondata al quarto d'ora più vicino, al massimo 24. */
export function oreDaDurata(inizio: Date, fine: Date): number {
  const minuti = (fine.getTime() - inizio.getTime()) / 60000;
  if (!(minuti > 0)) return 0;
  return Math.min(Math.round(minuti / 15) / 4, ORE_MASSIME_RIGA);
}

/**
 * Proposte di una giornata a partire dagli eventi del calendario.
 *
 * Escluse: eventi annullati, «Fuori sede», di intera giornata, rifiutati dal
 * collaboratore, di durata (arrotondata) nulla, che iniziano in un altro giorno civile del
 * fuso della giornata e quelli già gestiti (confermati o rifiutati).
 */
export function proposteDaEventi(
  eventi: readonly EventoGoogle[],
  giorno: string,
  eventiGestiti: ReadonlySet<string> = new Set()
): PropostaEvento[] {
  const proposte: PropostaEvento[] = [];

  for (const evento of eventi) {
    if (!evento.id || eventiGestiti.has(evento.id)) continue;
    if (evento.status === "cancelled") continue;
    if (evento.eventType === "outOfOffice") continue;
    if (!evento.start?.dateTime || !evento.end?.dateTime) continue;
    if (
      evento.attendees?.some(
        (p) => p.self === true && p.responseStatus === "declined"
      )
    ) {
      continue;
    }

    const inizio = new Date(evento.start.dateTime);
    const fine = new Date(evento.end.dateTime);
    if (isNaN(inizio.getTime()) || isNaN(fine.getTime())) continue;
    if (formattatoreGiorno.format(inizio) !== giorno) continue;

    const ore = oreDaDurata(inizio, fine);
    if (ore === 0) continue;

    proposte.push({
      eventoId: evento.id,
      titolo: evento.summary?.trim() || TITOLO_EVENTO_SENZA_TITOLO,
      descrizione: evento.description?.trim() ?? "",
      inizio: formattatoreOrario.format(inizio),
      fine: formattatoreOrario.format(fine),
      ore,
      dominiPartecipanti: dominiPartecipanti(evento),
    });
  }

  return proposte.sort((a, b) => a.inizio.localeCompare(b.inizio));
}

/**
 * Domini email dei partecipanti diversi dal collaboratore, in minuscolo e
 * senza duplicati. Il dominio del collaboratore è escluso: non indica il
 * cliente.
 */
function dominiPartecipanti(evento: EventoGoogle): string[] {
  const dominio = (email?: string) => email?.split("@")[1]?.trim().toLowerCase() || null;
  const partecipanti = evento.attendees ?? [];
  const dominiPropri = new Set(
    partecipanti.filter((p) => p.self === true).map((p) => dominio(p.email))
  );
  const domini = new Set<string>();
  for (const partecipante of partecipanti) {
    const d = dominio(partecipante.email);
    if (d && !dominiPropri.has(d)) domini.add(d);
  }
  return [...domini];
}

/**
 * Vero se l'account Google autorizzato al consenso è quello con cui il
 * collaboratore accede al coaching planner: le email sono confrontate senza
 * distinzione tra maiuscole e minuscole.
 */
export function stessoAccountGoogle(
  emailAutorizzata: string,
  emailAccesso: string
): boolean {
  return (
    emailAutorizzata.trim().toLowerCase() === emailAccesso.trim().toLowerCase()
  );
}
