import { NextResponse, type NextRequest } from "next/server";
import { ErroreAutorizzazione, risolviProfiloCollaboratoreCorrente } from "@/lib/dal";
import { offerteAbilitatePerCliente } from "@/lib/attivita";
import { rispostaDatiPrivati } from "@/lib/risposta-dati-privati";

/**
 * GET /api/attivita/offerte-cliente?cliente=<id>
 *
 * Restituisce le offerte attive di un cliente su cui il **solo** collaboratore
 * autenticato è abilitato: è la sorgente del cascade select cliente → offerta
 * del form riga attività.
 *
 * Il collaboratore è sempre derivato dalla sessione server, come per le altre
 * letture dell'area: il browser può indicare soltanto quale cliente guardare.
 *
 * Perché è una route HTTP e non più una Server Action: la risposta di una
 * Server Action riconcilia l'albero RSC del router con l'URL corrente e, dopo
 * un cambio giorno scritto con la History API, quella riconciliazione rimonta
 * la pagina azzerando il form in compilazione. Una lettura HTTP non tocca
 * l'albero del router e lascia intatto il form.
 *
 * Esiti:
 * - `400` parametro `cliente` assente, vuoto o composto di soli spazi,
 *   rilevato **prima** di interrogare il read model
 * - `401` sessione assente o non valida
 * - `403` profilo Collaboratore assente o disattivato
 * - `200` `{ offerte }`, eventualmente vuoto
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Come per `data` e `mese` delle route sorelle, il parametro viene
  // normalizzato prima di ogni altra cosa: un identificativo di soli spazi non
  // è un cliente e non deve raggiungere il read model.
  const clienteId = request.nextUrl.searchParams.get("cliente")?.trim();

  if (!clienteId) {
    return rispostaDatiPrivati({ errore: "Parametro 'cliente' richiesto" }, 400);
  }

  try {
    const profilo = await risolviProfiloCollaboratoreCorrente();

    if (profilo.stato !== "ATTIVO") {
      return rispostaDatiPrivati(
        { errore: "Profilo collaboratore non operativo" },
        403
      );
    }

    const offerte = await offerteAbilitatePerCliente(clienteId);

    return rispostaDatiPrivati({ offerte }, 200);
  } catch (errore) {
    if (errore instanceof ErroreAutorizzazione) {
      return rispostaDatiPrivati({ errore: errore.message }, errore.statusCode);
    }

    // Nessun dettaglio dell'errore interno esce dal confine HTTP.
    console.error("Errore nelle offerte abilitate per cliente:", errore);
    return rispostaDatiPrivati({ errore: "Errore interno" }, 500);
  }
}
