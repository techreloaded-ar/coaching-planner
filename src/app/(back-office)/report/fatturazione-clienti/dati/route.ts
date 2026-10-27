import { NextResponse, type NextRequest } from "next/server";
import { ErroreAutorizzazione, richiediRuoloApi } from "@/lib/dal";
import { reportFatturazioneClientiMese } from "@/lib/report";
import { rispostaDatiPrivati } from "@/lib/risposta-dati-privati";
import { parseTokenMese } from "@/domain/calendario";

/**
 * GET /report/fatturazione-clienti/dati?mese=YYYY-MM
 *
 * Dati del report di fatturazione clienti di un mese, letti dalla cache client
 * della pagina per il cambio mese senza navigazione RSC. Usa lo stesso
 * `reportFatturazioneClientiMese` della pagina e dell'esportazione, quindi la
 * guardia `richiediRuoloApi("AMMINISTRATORE")` vale anche qui.
 *
 * Esiti (il ruolo è verificato prima del parametro: un non amministratore
 * riceve sempre `403`):
 * - `401`/`403` sessione assente o ruolo diverso da amministratore
 * - `400` token `mese` assente o non nel formato `YYYY-MM`
 * - `200` `RisultatoReportFatturazione` del mese richiesto
 * - `500` errore interno (nessun dettaglio verso il client)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const mese = request.nextUrl.searchParams.get("mese");

  try {
    await richiediRuoloApi("AMMINISTRATORE");

    if (!mese || !parseTokenMese(mese)) {
      return rispostaDatiPrivati(
        { errore: "Parametro 'mese' richiesto nel formato YYYY-MM" },
        400,
      );
    }

    return rispostaDatiPrivati(await reportFatturazioneClientiMese(mese), 200);
  } catch (errore) {
    if (errore instanceof ErroreAutorizzazione) {
      return rispostaDatiPrivati({ errore: errore.message }, errore.statusCode);
    }

    // Nessun dettaglio dell'errore interno esce dal confine HTTP.
    console.error("Errore nei dati del report di fatturazione:", errore);
    return rispostaDatiPrivati({ errore: "Errore interno" }, 500);
  }
}
