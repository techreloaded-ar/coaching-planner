import { NextResponse, type NextRequest } from "next/server";
import { ErroreAutorizzazione, risolviProfiloCollaboratoreCorrente } from "@/lib/dal";
import { datiCalendarioMesePerCollaboratoreAutorizzato } from "@/lib/attivita";
import { parseTokenMese } from "@/domain/calendario";
import { rispostaDatiPrivati } from "@/lib/risposta-dati-privati";

/**
 * GET /api/attivita/calendario?mese=YYYY-MM
 *
 * Restituisce la sintesi mensile del calendario per il **solo** collaboratore
 * autenticato. Il collaboratore è sempre derivato dalla sessione server: la
 * route non accetta alcun identificativo dal browser, quindi non esiste un
 * parametro con cui chiedere i dati di un altro collaboratore.
 *
 * Le intestazioni delle risposte vivono in `@/lib/risposta-dati-privati` e sono
 * condivise con gli altri confini dati dell'area attività, così le route non
 * possono divergere sulla convenzione di cache.
 *
 * Esiti:
 * - `400` token `mese` assente o non nel formato `YYYY-MM`
 * - `401` sessione assente o non valida
 * - `403` profilo Collaboratore assente o disattivato
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
    const profilo = await risolviProfiloCollaboratoreCorrente();

    if (profilo.stato !== "ATTIVO") {
      return rispostaDatiPrivati(
        { errore: "Profilo collaboratore non operativo" },
        403
      );
    }

    const dati = await datiCalendarioMesePerCollaboratoreAutorizzato(
      mese,
      profilo.collaboratore.id
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
