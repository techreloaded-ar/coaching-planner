import "server-only";

import type { PropostaEvento } from "@/domain/calendario-google";

// Associazione degli impegni del calendario alle offerte tramite Google Gemini.
//
// Il coaching planner usa un'unica API key di server (GEMINI_API_KEY) per tutti
// i collaboratori. A Gemini arrivano solo titolo, descrizione e orario degli
// eventi del giorno e le offerte attive abilitate per il collaboratore; la
// risposta è accettata solo se indica una di quelle offerte. Qualsiasi errore
// degrada a «nessuna associazione»: le proposte restano, da completare a mano.
//
// Con E2E_TEST_MODE=true Gemini non viene contattato: un abbinamento
// deterministico per codice offerta o ragione sociale nel titolo ne fa le veci.

export interface OffertaAssociabile {
  id: string;
  codice: string;
  descrizione: string;
  cliente: { id: string; ragioneSociale: string };
}

const MODELLO_PREDEFINITO = "gemini-flash-latest";
const LUNGHEZZA_MASSIMA_DESCRIZIONE = 500;
const TIMEOUT_MS = 15000;

/** Mappa `eventoId → offertaId` delle sole associazioni valide. */
export async function associaEventiAOfferte(
  proposte: readonly PropostaEvento[],
  offerte: readonly OffertaAssociabile[]
): Promise<Map<string, string>> {
  if (proposte.length === 0 || offerte.length === 0) return new Map();

  if (process.env.E2E_TEST_MODE === "true") {
    return associazioneSimulataE2e(proposte, offerte);
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return new Map();

  const modello = process.env.GEMINI_MODEL?.trim() || MODELLO_PREDEFINITO;

  try {
    const risposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modello)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(corpoRichiesta(proposte, offerte)),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    if (!risposta.ok) {
      console.error(`Gemini ha risposto con ${risposta.status}`);
      return new Map();
    }

    const dati = (await risposta.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const testo = dati.candidates?.[0]?.content?.parts?.[0]?.text;
    return testo ? associazioniValide(testo, proposte, offerte) : new Map();
  } catch (errore) {
    // Solo il tipo di errore: la richiesta contiene l'API key negli header.
    console.error(
      "Associazione Gemini non riuscita:",
      errore instanceof Error ? errore.name : "errore sconosciuto"
    );
    return new Map();
  }
}

function corpoRichiesta(
  proposte: readonly PropostaEvento[],
  offerte: readonly OffertaAssociabile[]
) {
  const eventi = proposte.map((p) => ({
    eventoId: p.eventoId,
    titolo: p.titolo,
    descrizione: p.descrizione.slice(0, LUNGHEZZA_MASSIMA_DESCRIZIONE),
    orario: `${p.inizio}-${p.fine}`,
  }));
  const elencoOfferte = offerte.map((o) => ({
    offertaId: o.id,
    codice: o.codice,
    descrizione: o.descrizione,
    cliente: o.cliente.ragioneSociale,
  }));

  const istruzioni = [
    "Sei l'assistente di consuntivazione di una società di consulenza.",
    "Per ogni evento del calendario di un collaboratore indica l'offerta commerciale su cui va registrato il tempo,",
    "scegliendo esclusivamente tra le offerte elencate (per codice, descrizione o cliente citati nell'evento).",
    "Se l'evento non riguarda chiaramente una delle offerte (pause, impegni personali, riunioni interne generiche) usa offertaId null.",
    "Rispondi con un elemento per ogni evento.",
    "",
    `Offerte: ${JSON.stringify(elencoOfferte)}`,
    `Eventi: ${JSON.stringify(eventi)}`,
  ].join("\n");

  return {
    contents: [{ role: "user", parts: [{ text: istruzioni }] }],
    generationConfig: {
      temperature: 0,
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
              },
              required: ["eventoId", "offertaId"],
            },
          },
        },
        required: ["associazioni"],
      },
    },
  };
}

/** Scarta eventi sconosciuti e offerte non presenti tra quelle abilitate. */
function associazioniValide(
  testo: string,
  proposte: readonly PropostaEvento[],
  offerte: readonly OffertaAssociabile[]
): Map<string, string> {
  const eventiAmmessi = new Set(proposte.map((p) => p.eventoId));
  const offerteAmmesse = new Set(offerte.map((o) => o.id));
  const associazioni = new Map<string, string>();

  let dati: unknown;
  try {
    dati = JSON.parse(testo);
  } catch {
    return associazioni;
  }

  const elenco = (dati as { associazioni?: unknown })?.associazioni;
  if (!Array.isArray(elenco)) return associazioni;

  for (const voce of elenco as { eventoId?: unknown; offertaId?: unknown }[]) {
    if (
      typeof voce?.eventoId === "string" &&
      typeof voce.offertaId === "string" &&
      eventiAmmessi.has(voce.eventoId) &&
      offerteAmmesse.has(voce.offertaId)
    ) {
      associazioni.set(voce.eventoId, voce.offertaId);
    }
  }

  return associazioni;
}

function associazioneSimulataE2e(
  proposte: readonly PropostaEvento[],
  offerte: readonly OffertaAssociabile[]
): Map<string, string> {
  const associazioni = new Map<string, string>();
  for (const proposta of proposte) {
    const titolo = proposta.titolo.toLowerCase();
    const offerta = offerte.find(
      (o) =>
        titolo.includes(o.codice.toLowerCase()) ||
        titolo.includes(o.cliente.ragioneSociale.toLowerCase())
    );
    if (offerta) associazioni.set(proposta.eventoId, offerta.id);
  }
  return associazioni;
}
