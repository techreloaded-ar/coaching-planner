import "server-only";

import { FUSO_GIORNATA, type PropostaEvento } from "@/domain/calendario-google";

// Analisi degli impegni del calendario tramite Jev (TypeSafe AI) via
// OpenRouter: per ogni evento, se si riferisce chiaramente a un cliente,
// l'offerta più plausibile con la sua confidenza e se è palesemente non
// lavorativo. Jev non genera testo: risponde a domande tipizzate (noul,
// choice) con probabilità.
//
// Il coaching planner usa un'unica chiave di server (OPENROUTER_API_KEY) per
// tutti i collaboratori. A Jev arrivano, un evento per richiesta, titolo,
// descrizione, orario e domini degli invitati esterni (mai gli indirizzi; i
// DOMINI_INTERNI sono tolti qui) e le offerte abilitate per il collaboratore,
// comprese le chiuse. Forma della richiesta, istruzioni e regola di decisione
// sono quelle validate con lo script di valutazione offline di Jev sul dataset
// di prova (valuta-jev-associazioni.ts, fuori dal repository). Qualsiasi errore
// degrada a «nessuna associazione e nessun evento escluso» per l'evento
// coinvolto: le proposte restano, da completare a mano.
//
// Ogni analisi scrive una sola riga di log «Jev: esito=…» senza chiave né
// contenuti degli eventi, per diagnosticare da Vercel perché mancano i
// suggerimenti.
//
// Con E2E_TEST_MODE=true Jev non viene contattato: un abbinamento
// deterministico (vedi `analisiSimulataE2e`) ne fa le veci.

export interface OffertaAssociabile {
  id: string;
  codice: string;
  descrizione: string;
  /** Le offerte chiuse sono opzioni per Jev ma non vengono mai precompilate */
  attiva: boolean;
  createdAt: Date;
  cliente: { id: string; ragioneSociale: string };
}

export interface AnalisiEventi {
  /** `eventoId → offertaId` delle sole associazioni da precompilare */
  associazioni: Map<string, string>;
  /** Eventi palesemente non lavorativi, da non proporre */
  nonLavorativi: Set<string>;
}

export type EsitoJev =
  | "ok"
  | "chiave-assente"
  | "nessuna-offerta-abilitata"
  | "errore-http"
  | "errore-rete"
  | "timeout"
  | "risposta-non-valida";

const ENDPOINT = "https://openrouter.ai/api/v1/systemone";
const MODELLO_PREDEFINITO = "~typesafe/jev-latest";
const DOMINI_INTERNI_PREDEFINITI = "agilereloaded.it";
const SOGLIA_CONFIDENZA_PREDEFINITA = 0.7;
const SOGLIA_PROBABILITA = 0.5;
const LUNGHEZZA_MASSIMA_DESCRIZIONE = 500;
const LUNGHEZZA_MASSIMA_MESSAGGIO_ERRORE = 300;
const TIMEOUT_MS = 10000;
const TENTATIVI_MASSIMI = 3;
const RICHIESTE_IN_PARALLELO = 4;

const nessunaAnalisi = (): AnalisiEventi => ({
  associazioni: new Map(),
  nonLavorativi: new Set(),
});

/**
 * Una richiesta a Jev per ogni proposta della giornata `giorno` (YYYY-MM-DD),
 * al più `RICHIESTE_IN_PARALLELO` alla volta.
 */
export async function analizzaEventiCalendario(
  proposte: readonly PropostaEvento[],
  offerte: readonly OffertaAssociabile[],
  giorno: string
): Promise<AnalisiEventi> {
  if (proposte.length === 0) return nessunaAnalisi();

  const simulata = process.env.E2E_TEST_MODE === "true";
  const modello = simulata
    ? "simulato-e2e"
    : process.env.JEV_MODEL?.trim() || MODELLO_PREDEFINITO;
  const base = { modello, eventi: proposte.length, offerte: offerte.length };
  const inizio = Date.now();
  const durataMs = () => Date.now() - inizio;

  if (offerte.length === 0) {
    registraEsito("nessuna-offerta-abilitata", { ...base, durataMs: 0 });
    return nessunaAnalisi();
  }

  const proposteEsterne = proposte.map((p) => ({
    ...p,
    dominiPartecipanti: dominiEsterni(p.dominiPartecipanti),
  }));

  if (simulata) {
    const analisi = analisiSimulataE2e(proposteEsterne, offerte);
    registraEsito("ok", { ...base, durataMs: durataMs(), ...conteggi(analisi) });
    return analisi;
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    registraEsito("chiave-assente", { ...base, durataMs: 0 });
    return nessunaAnalisi();
  }

  const sogliaConfidenza = sogliaConfidenzaConfigurata();
  const etichette = etichettePerOfferta(offerte);
  const offertePerEtichetta = new Map(offerte.map((o) => [etichette.get(o.id)!, o]));

  const risultati = await inParallelo(proposteEsterne, RICHIESTE_IN_PARALLELO, (proposta) =>
    analizzaEvento(
      apiKey,
      corpoRichiesta(modello, proposta, giorno, offerte, etichette)
    )
  );

  const analisi: AnalisiConConteggi = { ...nessunaAnalisi(), associazioniBassa: 0 };
  let primoErrore: Exclude<RisultatoEvento, { esito: "ok" }> | undefined;
  let eventiInErrore = 0;

  risultati.forEach((risultato, indice) => {
    const eventoId = proposteEsterne[indice].eventoId;
    const risposte = risultato.esito === "ok" ? risposteValide(risultato.dati) : null;
    // Un'etichetta che non è tra le opzioni è una risposta non valida.
    const offerta = risposte ? offertePerEtichetta.get(risposte.scelta) : undefined;
    if (!risposte || !offerta) {
      eventiInErrore++;
      primoErrore ??= risultato.esito === "ok" ? { esito: "risposta-non-valida" } : risultato;
      return;
    }
    if (risposte.nonLavorativo >= SOGLIA_PROBABILITA) {
      analisi.nonLavorativi.add(eventoId);
      return;
    }
    if (
      offerta.attiva &&
      risposte.clienteIdentificato >= SOGLIA_PROBABILITA &&
      risposte.confidenza >= sogliaConfidenza
    ) {
      analisi.associazioni.set(eventoId, offerta.id);
    } else {
      analisi.associazioniBassa++;
    }
  });

  const { esito, ...dettagliErrore } = primoErrore ?? { esito: "ok" as const };
  registraEsito(esito, {
    ...base,
    durataMs: durataMs(),
    ...conteggi(analisi),
    ...(eventiInErrore > 0 ? { eventiInErrore } : {}),
    ...dettagliErrore,
  });
  return analisi;
}

// ── Configurazione ──────────────────────────────────────────────

/** Domini dei colleghi (DOMINI_INTERNI, separati da virgola): non indicano il cliente. */
function dominiInterni(): Set<string> {
  const valore = process.env.DOMINI_INTERNI ?? DOMINI_INTERNI_PREDEFINITI;
  return new Set(
    valore
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** Domini degli invitati senza quelli interni, che non devono pesare. */
export function dominiEsterni(domini: readonly string[]): string[] {
  const interni = dominiInterni();
  return domini.filter((d) => !interni.has(d.toLowerCase()));
}

/** JEV_SOGLIA_CONFIDENZA tra 0 e 1; altrimenti 0.7. */
function sogliaConfidenzaConfigurata(): number {
  const valore = Number(process.env.JEV_SOGLIA_CONFIDENZA?.trim() || NaN);
  return valore >= 0 && valore <= 1 ? valore : SOGLIA_CONFIDENZA_PREDEFINITA;
}

// ── Richiesta ───────────────────────────────────────────────────

const etichettaOfferta = (o: OffertaAssociabile) =>
  `${o.cliente.ragioneSociale} – ${o.codice}`;

/** Etichette univoche delle opzioni: Jev restituisce la chiave scelta. */
function etichettePerOfferta(offerte: readonly OffertaAssociabile[]): Map<string, string> {
  const etichette = new Map<string, string>();
  const usate = new Set<string>();
  for (const offerta of offerte) {
    let etichetta = etichettaOfferta(offerta);
    for (let n = 2; usate.has(etichetta); n++) etichetta = `${etichettaOfferta(offerta)} (${n})`;
    usate.add(etichetta);
    etichette.set(offerta.id, etichetta);
  }
  return etichette;
}

function corpoRichiesta(
  modello: string,
  proposta: PropostaEvento,
  giorno: string,
  offerte: readonly OffertaAssociabile[],
  etichette: Map<string, string>
) {
  const clienti = [...new Set(offerte.map((o) => o.cliente.ragioneSociale))];

  return {
    model: modello,
    state: {
      calendarEvent: {
        title: proposta.titolo,
        start: `${giorno}T${proposta.inizio}`,
        end: `${giorno}T${proposta.fine}`,
        timeZone: FUSO_GIORNATA,
        description: proposta.descrizione.slice(0, LUNGHEZZA_MASSIMA_DESCRIZIONE),
        attendeeDomains: proposta.dominiPartecipanti,
      },
    },
    questions: {
      clientIdentified: {
        type: "noul",
        instructions: {
          statement: "This calendar event clearly refers to one of the listed clients",
          clients: clienti,
        },
        criteria: {
          true:
            "An attendee email domain belongs to a listed client (for example rossi-spa.it belongs to Rossi S.p.A.), " +
            "or the title or description explicitly names a listed client, even when only colleagues attend " +
            "(for example «Preparazione workshop per Rossi»).",
          false:
            "No attendee domain belongs to a listed client (domains are missing, personal like gmail.com, " +
            "suppliers, partners or prospects not in the list) and neither the title nor the description " +
            "names a listed client: generic titles such as «Allineamento settimanale» or bare meeting links.",
        },
      },
      offer: {
        type: "choice",
        instructions:
          "Which client offer should the consultant log the time spent on this calendar event against? " +
          "Identify the client mainly from the attendee email domains, matching each domain to a client name " +
          "(for example rossi-spa.it belongs to Rossi S.p.A.); when no domain matches, a client explicitly " +
          "named in the title or description identifies it. Use title and description to choose among offers " +
          "of that client, and the event date to exclude offers created after the event.",
        criteria: Object.fromEntries(
          offerte.map((o) => [
            etichette.get(o.id)!,
            {
              client: o.cliente.ragioneSociale,
              offerCode: o.codice,
              offerDescription: o.descrizione,
              status: o.attiva ? "active" : "closed",
              createdOn: o.createdAt.toISOString().slice(0, 10),
            },
          ])
        ),
      },
      notWorkRelated: {
        type: "noul",
        instructions:
          "The calendar event is clearly not work-related (lunch, gym, medical appointment, personal errand)",
      },
    },
  };
}

// ── Chiamata ────────────────────────────────────────────────────

type RisultatoEvento =
  | { esito: "ok"; dati: unknown }
  | { esito: "errore-http"; stato: number; messaggio?: string }
  | { esito: "errore-rete"; tipoErrore: string }
  | { esito: "timeout" }
  | { esito: "risposta-non-valida" };

/**
 * Retry con backoff solo su 429 e 5xx; mai eccezioni.
 * ponytail: nessun tetto complessivo alla giornata (caso peggiore ~33 s per
 * gruppo di 4 impegni); aggiungere una scadenza globale con AbortSignal.any se
 * i log mostrano durate vicine al limite della funzione Vercel.
 */
async function analizzaEvento(apiKey: string, corpo: unknown): Promise<RisultatoEvento> {
  for (let tentativo = 1; ; tentativo++) {
    try {
      const risposta = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if ((risposta.status === 429 || risposta.status >= 500) && tentativo < TENTATIVI_MASSIMI) {
        await risposta.body?.cancel();
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (tentativo - 1)));
        continue;
      }
      if (!risposta.ok) {
        // 400 e 422 descrivono la richiesta, che contiene i dati dell'evento: niente messaggio.
        const conMessaggio = risposta.status !== 400 && risposta.status !== 422;
        return {
          esito: "errore-http",
          stato: risposta.status,
          ...(conMessaggio ? await erroreOpenRouter(risposta, apiKey) : {}),
        };
      }
      const dati = await risposta.json().catch(() => null);
      return dati === null ? { esito: "risposta-non-valida" } : { esito: "ok", dati };
    } catch (errore) {
      // Solo il tipo di errore: la richiesta contiene la chiave negli header.
      const nome = errore instanceof Error ? errore.name : "errore sconosciuto";
      return nome === "TimeoutError" ? { esito: "timeout" } : { esito: "errore-rete", tipoErrore: nome };
    }
  }
}

/** Messaggio dell'errore OpenRouter (es. «Insufficient credits»), senza la chiave. */
async function erroreOpenRouter(
  risposta: Response,
  apiKey: string
): Promise<{ messaggio?: string }> {
  try {
    const corpo = (await risposta.json()) as { error?: { message?: unknown } };
    return typeof corpo.error?.message === "string"
      ? {
          messaggio: corpo.error.message
            .replaceAll(apiKey, "[chiave]")
            .slice(0, LUNGHEZZA_MASSIMA_MESSAGGIO_ERRORE),
        }
      : {};
  } catch {
    return {};
  }
}

/** Le tre risposte attese, o `null` se la forma non è quella di System One. */
function risposteValide(dati: unknown) {
  const risposte = (dati as {
    answers?: {
      clientIdentified?: { noul?: unknown };
      offer?: { choice?: unknown; confidence?: unknown };
      notWorkRelated?: { noul?: unknown };
    };
  } | null)?.answers;
  const clienteIdentificato = risposte?.clientIdentified?.noul;
  const scelta = risposte?.offer?.choice;
  const confidenza = risposte?.offer?.confidence;
  const nonLavorativo = risposte?.notWorkRelated?.noul;
  if (
    typeof clienteIdentificato !== "number" ||
    typeof scelta !== "string" ||
    typeof confidenza !== "number" ||
    typeof nonLavorativo !== "number"
  ) {
    return null;
  }
  return { clienteIdentificato, scelta, confidenza, nonLavorativo };
}

/** Esegue `lavoro` su tutti gli elementi con al massimo `parallelismo` chiamate in volo. */
async function inParallelo<T, R>(
  elementi: readonly T[],
  parallelismo: number,
  lavoro: (elemento: T) => Promise<R>
): Promise<R[]> {
  const risultati: R[] = new Array(elementi.length);
  let prossimo = 0;
  const operaio = async () => {
    while (prossimo < elementi.length) {
      const indice = prossimo++;
      risultati[indice] = await lavoro(elementi[indice]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallelismo, elementi.length) }, operaio));
  return risultati;
}

// ── Diagnostica ─────────────────────────────────────────────────

interface AnalisiConConteggi extends AnalisiEventi {
  /** Eventi con un'offerta scelta ma non precompilata (soglia, cliente non identificato o offerta chiusa) */
  associazioniBassa: number;
}

function conteggi(analisi: AnalisiConConteggi) {
  return {
    associazioniAlta: analisi.associazioni.size,
    associazioniBassa: analisi.associazioniBassa,
    nonLavorativi: analisi.nonLavorativi.size,
  };
}

/**
 * Riga unica di diagnostica: solo esito, conteggi, modello, durata e, per gli
 * errori HTTP, stato e messaggio di OpenRouter. Mai chiave né contenuti di eventi.
 * Con più eventi in errore l'esito è quello del primo.
 */
function registraEsito(
  esito: EsitoJev,
  dettagli: Record<string, string | number | undefined>
): void {
  const campi = Object.entries(dettagli)
    .filter(([, valore]) => valore !== undefined)
    .map(([chiave, valore]) =>
      typeof valore === "string" && /[\s"]/.test(valore)
        ? `${chiave}=${JSON.stringify(valore)}`
        : `${chiave}=${valore}`
    );
  const riga = ["Jev:", `esito=${esito}`, ...campi].join(" ");
  if (esito === "ok") console.info(riga);
  else console.warn(riga);
}

// ── Simulazione e2e ─────────────────────────────────────────────

const PAROLE_NON_LAVORATIVE = /\b(pranzo|palestra|medico|dentista|personale)\b/i;

const normalizza = (testo: string) => testo.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Abbinamento deterministico usato in E2E_TEST_MODE, con la regola di Jev
 * (cliente riconoscibile dal dominio o dal nome citato):
 * - non lavorativo se il titolo contiene pranzo, palestra, medico, dentista o personale;
 * - precompilata un'offerta attiva se titolo o descrizione citano il suo codice
 *   o la ragione sociale del cliente, oppure se un dominio esterno degli
 *   invitati (prima del punto) compare nella ragione sociale;
 * - non precompilata (conteggiata bassa) se il titolo cita solo la descrizione dell'offerta.
 */
function analisiSimulataE2e(
  proposte: readonly PropostaEvento[],
  offerte: readonly OffertaAssociabile[]
): AnalisiConConteggi {
  const analisi: AnalisiConConteggi = { ...nessunaAnalisi(), associazioniBassa: 0 };

  for (const proposta of proposte) {
    if (PAROLE_NON_LAVORATIVE.test(proposta.titolo)) {
      analisi.nonLavorativi.add(proposta.eventoId);
      continue;
    }

    const testo = `${proposta.titolo}\n${proposta.descrizione}`.toLowerCase();
    const etichetteDomini = proposta.dominiPartecipanti
      .map((d) => normalizza(d.split(".")[0]))
      .filter((etichetta) => etichetta.length >= 4);

    const alta = offerte.find(
      (o) =>
        o.attiva &&
        (testo.includes(o.codice.toLowerCase()) ||
          testo.includes(o.cliente.ragioneSociale.toLowerCase()) ||
          etichetteDomini.some((e) => normalizza(o.cliente.ragioneSociale).includes(e)))
    );
    if (alta) {
      analisi.associazioni.set(proposta.eventoId, alta.id);
      continue;
    }

    if (offerte.some((o) => testo.includes(o.descrizione.toLowerCase()))) {
      analisi.associazioniBassa++;
    }
  }

  return analisi;
}
