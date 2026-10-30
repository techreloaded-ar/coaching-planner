import { NextResponse, type NextRequest } from "next/server";
import { ErroreAutorizzazione } from "@/lib/dal";
import { risolviCollaboratoreDelFoglio } from "@/lib/foglio-attivita";
import { PARAMETRO_COLLABORATORE_CONSULTATO } from "@/lib/url-foglio-attivita";
import { righeDelGiornoPerCollaboratoreAutorizzato } from "@/lib/attivita";
import { parseDataGiorno } from "@/domain/calendario";
import { rispostaDatiPrivati } from "@/lib/risposta-dati-privati";

/**
 * GET /api/attivita/giornata?data=YYYY-MM-DD
 *
 * Restituisce le righe di una giornata del collaboratore autenticato oppure,
 * solo per un amministratore, del collaboratore indicato con il parametro
 * facoltativo `collaboratore`: come per il calendario mensile l'autorizzazione
 * è decisa dal server in `@/lib/foglio-attivita`.
 *
 * Esiti:
 * - `400` parametro `data` assente o non nel formato `YYYY-MM-DD` (o data
 *   civilmente inesistente), rilevato **prima** di interrogare il read model
 * - `401` sessione assente o non valida
 * - `403` profilo Collaboratore assente o disattivato, oppure `collaboratore`
 *   indicato da un non amministratore
 * - `404` collaboratore indicato inesistente
 * - `200` DTO `DatiGiornataAttivita` del giorno richiesto
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const data = request.nextUrl.searchParams.get("data");

  if (!data || !parseDataGiorno(data)) {
    return rispostaDatiPrivati(
      { errore: "Parametro 'data' richiesto nel formato YYYY-MM-DD" },
      400
    );
  }

  try {
    const collaboratore = await risolviCollaboratoreDelFoglio(
      request.nextUrl.searchParams.get(PARAMETRO_COLLABORATORE_CONSULTATO)
    );

    if (!collaboratore) {
      return rispostaDatiPrivati({ errore: "Collaboratore non trovato" }, 404);
    }

    const dati = await righeDelGiornoPerCollaboratoreAutorizzato(
      data,
      collaboratore.id
    );

    return rispostaDatiPrivati(dati, 200);
  } catch (errore) {
    if (errore instanceof ErroreAutorizzazione) {
      return rispostaDatiPrivati({ errore: errore.message }, errore.statusCode);
    }

    // Nessun dettaglio dell'errore interno esce dal confine HTTP.
    console.error("Errore nella giornata di attività:", errore);
    return rispostaDatiPrivati({ errore: "Errore interno" }, 500);
  }
}
