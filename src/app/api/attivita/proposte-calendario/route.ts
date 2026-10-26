import type { NextRequest, NextResponse } from "next/server";
import { ErroreAutorizzazione, risolviProfiloCollaboratoreCorrente } from "@/lib/dal";
import { proposteCalendarioPerCollaboratoreAutorizzato } from "@/lib/proposte-calendario";
import { parseDataGiorno } from "@/domain/calendario";
import { rispostaDatiPrivati } from "@/lib/risposta-dati-privati";

/**
 * GET /api/attivita/proposte-calendario?data=YYYY-MM-DD
 *
 * Proposte di ore dal calendario Google del **solo** collaboratore
 * autenticato: come le altre letture dell'area attività, il collaboratore è
 * derivato dalla sessione e la route non accetta identificativi dal browser.
 *
 * Esiti: `400` data assente o non valida; `401` senza sessione; `403` profilo
 * non operativo; `200` DTO `ProposteCalendarioGiornata`.
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
      return rispostaDatiPrivati({ errore: "Profilo collaboratore non operativo" }, 403);
    }

    const dati = await proposteCalendarioPerCollaboratoreAutorizzato(
      data,
      profilo.collaboratore.id
    );
    return rispostaDatiPrivati(dati, 200);
  } catch (errore) {
    if (errore instanceof ErroreAutorizzazione) {
      return rispostaDatiPrivati({ errore: errore.message }, errore.statusCode);
    }
    console.error("Errore nelle proposte dal calendario:", errore);
    return rispostaDatiPrivati({ errore: "Errore interno" }, 500);
  }
}
