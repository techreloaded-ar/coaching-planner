import "server-only";

import type { PropostaEvento } from "@/domain/calendario-google";

// Analisi degli impegni del calendario tramite Google Gemini: offerta più
// plausibile con la sua confidenza ed eventi palesemente non lavorativi.
//
// Il coaching planner usa un'unica API key di server (GEMINI_API_KEY) per tutti
// i collaboratori. A Gemini arrivano titolo, descrizione, orario e domini dei
// partecipanti degli eventi del giorno, le offerte attive abilitate per il
// collaboratore e le sue righe recenti (nota e offerta) come esempi; la
// risposta è accettata solo se indica una di quelle offerte. Qualsiasi errore
// degrada a «nessuna associazione e nessun evento escluso»: le proposte
// restano, da completare a mano.
//
// Ogni analisi scrive una sola riga di log «Gemini: esito=…» senza chiave né
// contenuti degli eventi, per diagnosticare da Vercel perché mancano i
// suggerimenti.
//
// Con E2E_TEST_MODE=true Gemini non viene contattato: un abbinamento
// deterministico (vedi `analisiSimulataE2e`) ne fa le veci.

export interface OffertaAssociabile {
  id: string;
  codice: string;
  descrizione: string;
  cliente: { id: string; ragioneSociale: string };
}

/** Riga già registrata dal collaboratore, usata come esempio di associazione. */
export interface EsempioAssociazione {
  nota: string;
  offertaId: string;
}

export interface AnalisiEventi {
  /** `eventoId → offertaId` delle sole associazioni a confidenza alta */
  associazioni: Map<string, string>;
  /** Eventi palesemente non lavorativi, da non proporre */
  nonLavorativi: Set<string>;
}

export type EsitoGemini =
  | "ok"
  | "chiave-assente"
  | "nessuna-offerta-abilitata"
  | "errore-http"
  | "errore-rete"
  | "timeout"
  | "risposta-non-valida";

const MODELLO_PREDEFINITO = "gemini-flash-latest";
const LUNGHEZZA_MASSIMA_DESCRIZIONE = 500;
const LUNGHEZZA_MASSIMA_MESSAGGIO_ERRORE = 300;
const TIMEOUT_MS = 15000;

const nessunaAnalisi = (): AnalisiEventi => ({
  associazioni: new Map(),
  nonLavorativi: new Set(),
});

/** Una sola chiamata a Gemini per tutte le proposte della giornata. */
export async function analizzaEventiCalendario(
  proposte: readonly PropostaEvento[],
  offerte: readonly OffertaAssociabile[],
  esempi: readonly EsempioAssociazione[] = []
): Promise<AnalisiEventi> {
  if (proposte.length === 0) return nessunaAnalisi();

  const simulata = process.env.E2E_TEST_MODE === "true";
  const modello = simulata
    ? "simulato-e2e"
    : process.env.GEMINI_MODEL?.trim() || MODELLO_PREDEFINITO;
  const base = { modello, eventi: proposte.length, offerte: offerte.length };
  const inizio = Date.now();
  const durataMs = () => Date.now() - inizio;

  if (offerte.length === 0) {
    registraEsito("nessuna-offerta-abilitata", { ...base, durataMs: 0 });
    return nessunaAnalisi();
  }

  if (simulata) {
    const analisi = analisiSimulataE2e(proposte, offerte);
    registraEsito("ok", { ...base, durataMs: durataMs(), ...conteggi(analisi) });
    return analisi;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    registraEsito("chiave-assente", { ...base, durataMs: 0 });
    return nessunaAnalisi();
  }

  try {
    const risposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modello)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(corpoRichiesta(modello, proposte, offerte, esempi)),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    if (!risposta.ok) {
      registraEsito("errore-http", {
        ...base,
        durataMs: durataMs(),
        stato: risposta.status,
        ...(await erroreGoogle(risposta, apiKey)),
      });
      return nessunaAnalisi();
    }

    const dati = (await risposta.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const testo = dati.candidates?.[0]?.content?.parts?.[0]?.text;
    const analisi = testo ? analisiValida(testo, proposte, offerte) : null;
    if (!analisi) {
      registraEsito("risposta-non-valida", { ...base, durataMs: durataMs() });
      return nessunaAnalisi();
    }

    registraEsito("ok", { ...base, durataMs: durataMs(), ...conteggi(analisi) });
    return analisi;
  } catch (errore) {
    // Solo il tipo di errore: la richiesta contiene l'API key negli header.
    const nome = errore instanceof Error ? errore.name : "errore sconosciuto";
    registraEsito(nome === "TimeoutError" ? "timeout" : "errore-rete", {
      ...base,
      durataMs: durataMs(),
      ...(nome === "TimeoutError" ? {} : { tipoErrore: nome }),
    });
    return nessunaAnalisi();
  }
}

// ── Diagnostica ─────────────────────────────────────────────────

interface AnalisiConConteggi extends AnalisiEventi {
  /** Eventi con un'offerta valida ma confidenza bassa */
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
 * errori HTTP, stato e messaggio di Google. Mai chiave né contenuti di eventi.
 */
function registraEsito(
  esito: EsitoGemini,
  dettagli: Record<string, string | number | undefined>
): void {
  const campi = Object.entries(dettagli)
    .filter(([, valore]) => valore !== undefined)
    .map(([chiave, valore]) =>
      typeof valore === "string" && /[\s"]/.test(valore)
        ? `${chiave}=${JSON.stringify(valore)}`
        : `${chiave}=${valore}`
    );
  const riga = ["Gemini:", `esito=${esito}`, ...campi].join(" ");
  if (esito === "ok") console.info(riga);
  else console.warn(riga);
}

/** Stato e messaggio dell'errore Google (es. «Your prepayment credits are depleted»). */
async function erroreGoogle(
  risposta: Response,
  apiKey: string
): Promise<{ statoGoogle?: string; messaggio?: string }> {
  try {
    const corpo = (await risposta.json()) as {
      error?: { status?: unknown; message?: unknown };
    };
    const messaggio =
      typeof corpo.error?.message === "string"
        ? corpo.error.message
            .replaceAll(apiKey, "[chiave]")
            .slice(0, LUNGHEZZA_MASSIMA_MESSAGGIO_ERRORE)
        : undefined;
    const statoGoogle =
      typeof corpo.error?.status === "string" ? corpo.error.status : undefined;
    return { statoGoogle, messaggio };
  } catch {
    return {};
  }
}

// ── Richiesta ───────────────────────────────────────────────────

function corpoRichiesta(
  modello: string,
  proposte: readonly PropostaEvento[],
  offerte: readonly OffertaAssociabile[],
  esempi: readonly EsempioAssociazione[]
) {
  const eventi = proposte.map((p) => ({
    eventoId: p.eventoId,
    titolo: p.titolo,
    descrizione: p.descrizione.slice(0, LUNGHEZZA_MASSIMA_DESCRIZIONE),
    orario: `${p.inizio}-${p.fine}`,
    dominiPartecipanti: p.dominiPartecipanti,
  }));
  const elencoOfferte = offerte.map((o) => ({
    offertaId: o.id,
    codice: o.codice,
    descrizione: o.descrizione,
    cliente: o.cliente.ragioneSociale,
  }));

  const istruzioni = [
    "Sei l'assistente di consuntivazione di una società di consulenza.",
    "Per ogni evento del calendario di un collaboratore indica l'offerta commerciale più plausibile su cui registrare il tempo,",
    "scegliendo esclusivamente tra le offerte elencate.",
    "Usa tutti gli indizi: codice, descrizione o cliente citati nel titolo o nella descrizione,",
    "i domini email dei partecipanti (ad esempio partecipanti @pippo.com indicano il cliente «Pippo»)",
    "e le righe già registrate dal collaboratore, che mostrano su quale offerta finiscono eventi simili.",
    "Indica confidenza ALTA solo se gli indizi puntano chiaramente a un'unica offerta; altrimenti BASSA.",
    "Se nessuna offerta è plausibile usa offertaId null e confidenza BASSA.",
    "Indica nonLavorativo true solo per eventi palesemente non lavorativi (pranzo, palestra, visite mediche, impegni personali);",
    "nel dubbio, e per le riunioni interne, usa false.",
    "Rispondi con un elemento per ogni evento.",
    "",
    `Offerte: ${JSON.stringify(elencoOfferte)}`,
    `Righe registrate di recente: ${JSON.stringify(esempi)}`,
    `Eventi: ${JSON.stringify(eventi)}`,
  ].join("\n");

  return {
    contents: [{ role: "user", parts: [{ text: istruzioni }] }],
    generationConfig: {
      temperature: 0,
      // Ragionamento minimo per restare nel timeout: i modelli «pro» non
      // accettano un budget nullo, quindi vale solo per i «flash».
      ...(modello.includes("flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          associazioni: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                eventoId: { type: "STRING" },
                offertaId: { type: "STRING", nullable: true },
                confidenza: { type: "STRING", enum: ["ALTA", "BASSA"] },
                nonLavorativo: { type: "BOOLEAN" },
              },
              required: ["eventoId", "offertaId", "confidenza", "nonLavorativo"],
            },
          },
        },
        required: ["associazioni"],
      },
    },
  };
}

/**
 * Scarta eventi sconosciuti e offerte non presenti tra quelle abilitate;
 * `null` se la risposta non è il JSON atteso.
 */
function analisiValida(
  testo: string,
  proposte: readonly PropostaEvento[],
  offerte: readonly OffertaAssociabile[]
): AnalisiConConteggi | null {
  let dati: unknown;
  try {
    dati = JSON.parse(testo);
  } catch {
    return null;
  }

  const elenco = (dati as { associazioni?: unknown })?.associazioni;
  if (!Array.isArray(elenco)) return null;

  const eventiAmmessi = new Set(proposte.map((p) => p.eventoId));
  const offerteAmmesse = new Set(offerte.map((o) => o.id));
  const analisi: AnalisiConConteggi = { ...nessunaAnalisi(), associazioniBassa: 0 };

  for (const voce of elenco as {
    eventoId?: unknown;
    offertaId?: unknown;
    confidenza?: unknown;
    nonLavorativo?: unknown;
  }[]) {
    if (typeof voce?.eventoId !== "string" || !eventiAmmessi.has(voce.eventoId)) continue;

    if (voce.nonLavorativo === true) {
      analisi.nonLavorativi.add(voce.eventoId);
      continue;
    }
    if (typeof voce.offertaId !== "string" || !offerteAmmesse.has(voce.offertaId)) continue;

    if (voce.confidenza === "ALTA") analisi.associazioni.set(voce.eventoId, voce.offertaId);
    else analisi.associazioniBassa++;
  }

  return analisi;
}

// ── Simulazione e2e ─────────────────────────────────────────────

const PAROLE_NON_LAVORATIVE = /\b(pranzo|palestra|medico|dentista|personale)\b/i;

const normalizza = (testo: string) => testo.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Abbinamento deterministico usato in E2E_TEST_MODE:
 * - non lavorativo se il titolo contiene pranzo, palestra, medico, dentista o personale;
 * - confidenza alta se il titolo cita codice offerta o ragione sociale, oppure
 *   se un dominio dei partecipanti (prima del punto) compare nella ragione sociale;
 * - confidenza bassa se il titolo cita solo la descrizione dell'offerta.
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

    const titolo = proposta.titolo.toLowerCase();
    const etichetteDomini = proposta.dominiPartecipanti
      .map((d) => normalizza(d.split(".")[0]))
      .filter((etichetta) => etichetta.length >= 4);

    const alta = offerte.find(
      (o) =>
        titolo.includes(o.codice.toLowerCase()) ||
        titolo.includes(o.cliente.ragioneSociale.toLowerCase()) ||
        etichetteDomini.some((e) => normalizza(o.cliente.ragioneSociale).includes(e))
    );
    if (alta) {
      analisi.associazioni.set(proposta.eventoId, alta.id);
      continue;
    }

    if (offerte.some((o) => titolo.includes(o.descrizione.toLowerCase()))) {
      analisi.associazioniBassa++;
    }
  }

  return analisi;
}
