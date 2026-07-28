import { NextResponse, type NextRequest } from "next/server";
import { ErroreAutorizzazione, risolviProfiloCollaboratoreCorrente } from "@/lib/dal";
import { datiCalendarioMesePerCollaboratoreAutorizzato } from "@/lib/attivita";
import { parseTokenMese } from "@/domain/calendario";

/**
 * Intestazioni delle risposte con dati del collaboratore.
 *
 * `private, no-store` impedisce qualunque cache HTTP condivisa o del browser:
 * la finestra di staleness del calendario è governata **esclusivamente** dalla
 * cache client in memoria, non da una seconda cache implicita.
 * `Vary: Cookie` evita che un'infrastruttura intermedia consideri equivalenti
 * risposte appartenenti a sessioni diverse.
 */
const INTESTAZIONI_DATI_PRIVATI = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
} as const;

function risposta(corpo: unknown, status: number): NextResponse {
  return NextResponse.json(corpo, {
    status,
    headers: INTESTAZIONI_DATI_PRIVATI,
  });
}

/**
 * GET /api/attivita/calendario?mese=YYYY-MM
 *
 * Restituisce la sintesi mensile del calendario per il **solo** collaboratore
 * autenticato. Il collaboratore è sempre derivato dalla sessione server: la
 * route non accetta alcun identificativo dal browser, quindi non esiste un
 * parametro con cui chiedere i dati di un altro collaboratore.
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
    return risposta(
      { errore: "Parametro 'mese' richiesto nel formato YYYY-MM" },
      400
    );
  }

  try {
    const profilo = await risolviProfiloCollaboratoreCorrente();

    if (profilo.stato !== "ATTIVO") {
      return risposta(
        { errore: "Profilo collaboratore non operativo" },
        403
      );
    }

    const dati = await datiCalendarioMesePerCollaboratoreAutorizzato(
      mese,
      profilo.collaboratore.id
    );

    return risposta(dati, 200);
  } catch (errore) {
    if (errore instanceof ErroreAutorizzazione) {
      return risposta({ errore: errore.message }, errore.statusCode);
    }

    // Nessun dettaglio dell'errore interno esce dal confine HTTP.
    console.error("Errore nel calendario mensile:", errore);
    return risposta({ errore: "Errore interno" }, 500);
  }
}
