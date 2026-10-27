import { type NextRequest } from "next/server";
import { ErroreAutorizzazione } from "@/lib/dal";
import { reportFatturazioneClientiMese } from "@/lib/report";
import { rispostaDatiPrivati, INTESTAZIONI_DATI_PRIVATI } from "@/lib/risposta-dati-privati";
import { creaXlsx } from "@/lib/xlsx";
import {
  costruisciFogliFatturazioneClienti,
  nomeFileFatturazioneClienti,
} from "@/lib/esportazione-fatturazione";
import {
  etichettaMese,
  parseTokenMese,
  tokenMeseCorrente,
} from "@/domain/calendario";

const CONTENT_TYPE_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * GET /report/fatturazione-clienti/esporta?mese=YYYY-MM
 *
 * Scarica il report mensile di fatturazione clienti in formato Excel. Usa lo
 * stesso `reportFatturazioneClientiMese` della pagina, quindi i dati coincidono
 * con lo schermo e la guardia `richiediRuoloApi("AMMINISTRATORE")` vale anche
 * per l'esportazione.
 *
 * Esiti:
 * - `200` file `.xlsx` come allegato
 * - `401`/`403` sessione assente o ruolo diverso da amministratore
 * - `500` errore interno (nessun dettaglio verso il client)
 *
 * Un mese assente o non valido ricade sul mese corrente, come nella pagina.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const richiesto = request.nextUrl.searchParams.get("mese");
  const token =
    richiesto && parseTokenMese(richiesto) ? richiesto : tokenMeseCorrente();

  try {
    const report = await reportFatturazioneClientiMese(token);
    const corpo = creaXlsx(
      costruisciFogliFatturazioneClienti(report, etichettaMese(token)),
    );

    return new Response(new Uint8Array(corpo), {
      status: 200,
      headers: {
        ...INTESTAZIONI_DATI_PRIVATI,
        "Content-Type": CONTENT_TYPE_XLSX,
        "Content-Disposition": `attachment; filename="${nomeFileFatturazioneClienti(token)}"`,
        "Content-Length": String(corpo.length),
      },
    });
  } catch (errore) {
    if (errore instanceof ErroreAutorizzazione) {
      return rispostaDatiPrivati({ errore: errore.message }, errore.statusCode);
    }

    // Nessun dettaglio dell'errore interno esce dal confine HTTP.
    console.error("Errore nell'esportazione del report di fatturazione:", errore);
    return rispostaDatiPrivati({ errore: "Errore interno" }, 500);
  }
}
