import { NextResponse, type NextRequest } from "next/server";
import { ErroreAutorizzazione } from "@/lib/dal";
import { risolviCollaboratoreDelFoglio } from "@/lib/foglio-attivita";
import { PARAMETRO_COLLABORATORE_CONSULTATO } from "@/lib/url-foglio-attivita";
import { contestoInserimentoPerCollaboratoreAutorizzato } from "@/lib/attivita";
import { rispostaDatiPrivati } from "@/lib/risposta-dati-privati";

/**
 * GET /api/attivita/contesto-inserimento
 *
 * Restituisce i dati che popolano il form riga attività — clienti selezionabili
 * e voci di rimborso trasferta — del collaboratore autenticato oppure, solo per
 * un amministratore, del collaboratore indicato con il parametro facoltativo
 * `collaboratore`. Il contesto è invariante rispetto al giorno; i clienti
 * consigliati seguono le abilitazioni del collaboratore del foglio.
 *
 * Esiti:
 * - `401` sessione assente o non valida
 * - `403` profilo Collaboratore assente o disattivato, oppure `collaboratore`
 *   indicato da un non amministratore
 * - `404` collaboratore indicato inesistente
 * - `200` DTO `ContestoInserimentoGiornata`
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const collaboratore = await risolviCollaboratoreDelFoglio(
      request.nextUrl.searchParams.get(PARAMETRO_COLLABORATORE_CONSULTATO)
    );

    if (!collaboratore) {
      return rispostaDatiPrivati({ errore: "Collaboratore non trovato" }, 404);
    }

    const dati = await contestoInserimentoPerCollaboratoreAutorizzato(
      collaboratore.id
    );

    return rispostaDatiPrivati(dati, 200);
  } catch (errore) {
    if (errore instanceof ErroreAutorizzazione) {
      return rispostaDatiPrivati({ errore: errore.message }, errore.statusCode);
    }

    // Nessun dettaglio dell'errore interno esce dal confine HTTP.
    console.error("Errore nel contesto di inserimento:", errore);
    return rispostaDatiPrivati({ errore: "Errore interno" }, 500);
  }
}
