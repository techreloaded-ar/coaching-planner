import { NextResponse, type NextRequest } from "next/server";
import { ErroreAutorizzazione, risolviProfiloCollaboratoreCorrente } from "@/lib/dal";
import { righeDelGiornoPerCollaboratoreAutorizzato } from "@/lib/attivita";
import { parseDataGiorno } from "@/domain/calendario";
import { rispostaDatiPrivati } from "@/lib/risposta-dati-privati";

/**
 * GET /api/attivita/giornata?data=YYYY-MM-DD
 *
 * Restituisce le righe di una giornata per il **solo** collaboratore
 * autenticato. Come per il calendario mensile, il collaboratore è sempre
 * derivato dalla sessione server: la route non accetta alcun identificativo dal
 * browser, quindi non esiste un parametro con cui chiedere i dati di un altro
 * collaboratore.
 *
 * Esiti:
 * - `400` parametro `data` assente o non nel formato `YYYY-MM-DD` (o data
 *   civilmente inesistente), rilevato **prima** di interrogare il read model
 * - `401` sessione assente o non valida
 * - `403` profilo Collaboratore assente o disattivato
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
    const profilo = await risolviProfiloCollaboratoreCorrente();

    if (profilo.stato !== "ATTIVO") {
      return rispostaDatiPrivati(
        { errore: "Profilo collaboratore non operativo" },
        403
      );
    }

    const dati = await righeDelGiornoPerCollaboratoreAutorizzato(
      data,
      profilo.collaboratore.id
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
