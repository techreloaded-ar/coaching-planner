import { NextResponse } from "next/server";
import { ErroreAutorizzazione, risolviProfiloCollaboratoreCorrente } from "@/lib/dal";
import { contestoInserimentoPerCollaboratoreAutorizzato } from "@/lib/attivita";
import { rispostaDatiPrivati } from "@/lib/risposta-dati-privati";

/**
 * GET /api/attivita/contesto-inserimento
 *
 * Restituisce i dati che popolano il form riga attività — clienti selezionabili
 * e voci di rimborso trasferta — per il **solo** collaboratore autenticato.
 *
 * La route non accetta alcun parametro: il contesto è invariante rispetto al
 * giorno e il collaboratore è sempre derivato dalla sessione server, quindi non
 * esiste un parametro con cui chiedere il contesto di un altro collaboratore.
 *
 * Esiti:
 * - `401` sessione assente o non valida
 * - `403` profilo Collaboratore assente o disattivato
 * - `200` DTO `ContestoInserimentoGiornata`
 */
export async function GET(): Promise<NextResponse> {
  try {
    const profilo = await risolviProfiloCollaboratoreCorrente();

    if (profilo.stato !== "ATTIVO") {
      return rispostaDatiPrivati(
        { errore: "Profilo collaboratore non operativo" },
        403
      );
    }

    const dati = await contestoInserimentoPerCollaboratoreAutorizzato(
      profilo.collaboratore.id
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
