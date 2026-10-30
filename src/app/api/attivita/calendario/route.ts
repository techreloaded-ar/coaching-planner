import { NextResponse, type NextRequest } from "next/server";
import { ErroreAutorizzazione } from "@/lib/dal";
import { risolviCollaboratoreDelFoglio } from "@/lib/foglio-attivita";
import { PARAMETRO_COLLABORATORE_CONSULTATO } from "@/lib/url-foglio-attivita";
import { datiCalendarioMesePerCollaboratoreAutorizzato } from "@/lib/attivita";
import { parseTokenMese } from "@/domain/calendario";
import { rispostaDatiPrivati } from "@/lib/risposta-dati-privati";

/**
 * GET /api/attivita/calendario?mese=YYYY-MM&collaboratore=<id>
 *
 * Restituisce la sintesi mensile del calendario del collaboratore autenticato
 * oppure, solo per un amministratore, del collaboratore indicato con il
 * parametro facoltativo `collaboratore`. L'autorizzazione è decisa dal server
 * in `@/lib/foglio-attivita`: per un non amministratore il parametro produce
 * un `403`, mai i dati di un altro collaboratore.
 *
 * Le intestazioni delle risposte vivono in `@/lib/risposta-dati-privati` e sono
 * condivise con gli altri confini dati dell'area attività, così le route non
 * possono divergere sulla convenzione di cache.
 *
 * Esiti:
 * - `400` token `mese` assente o non nel formato `YYYY-MM`
 * - `401` sessione assente o non valida
 * - `403` profilo Collaboratore assente o disattivato, oppure `collaboratore`
 *   indicato da un non amministratore
 * - `404` collaboratore indicato inesistente
 * - `200` DTO `DatiCalendarioMese` del mese richiesto
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const mese = request.nextUrl.searchParams.get("mese");

  if (!mese || !parseTokenMese(mese)) {
    return rispostaDatiPrivati(
      { errore: "Parametro 'mese' richiesto nel formato YYYY-MM" },
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

    const dati = await datiCalendarioMesePerCollaboratoreAutorizzato(
      mese,
      collaboratore.id
    );

    return rispostaDatiPrivati(dati, 200);
  } catch (errore) {
    if (errore instanceof ErroreAutorizzazione) {
      return rispostaDatiPrivati({ errore: errore.message }, errore.statusCode);
    }

    // Nessun dettaglio dell'errore interno esce dal confine HTTP.
    console.error("Errore nel calendario mensile:", errore);
    return rispostaDatiPrivati({ errore: "Errore interno" }, 500);
  }
}
