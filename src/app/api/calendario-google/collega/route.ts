import { NextResponse } from "next/server";
import { generateCodeVerifier, generateState } from "arctic";
import { ErroreAutorizzazione, risolviProfiloCollaboratoreCorrente, richiediSessioneApi } from "@/lib/dal";
import { urlConsensoCalendario } from "@/lib/calendario-google";
import {
  COOKIE_CODE_VERIFIER_CALENDARIO,
  COOKIE_STATE_CALENDARIO,
  opzioniCookieOAuthCalendario,
} from "../cookie-oauth";

/**
 * GET /api/calendario-google/collega
 *
 * Avvia il consenso Google in sola lettura sul calendario del collaboratore
 * autenticato. È un flusso separato dal login: state e code verifier vivono in
 * cookie propri, limitati alle rotte del calendario.
 *
 * Esiti: redirect al consenso Google; `401` senza sessione; `403` senza
 * profilo Collaboratore attivo.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const sessione = await richiediSessioneApi();
    const profilo = await risolviProfiloCollaboratoreCorrente(sessione);

    if (profilo.stato !== "ATTIVO") {
      return NextResponse.json(
        { errore: "Profilo collaboratore non operativo" },
        { status: 403 }
      );
    }

    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const response = NextResponse.redirect(
      urlConsensoCalendario(state, codeVerifier, sessione.email)
    );
    response.cookies.set(COOKIE_STATE_CALENDARIO, state, opzioniCookieOAuthCalendario(600));
    response.cookies.set(
      COOKIE_CODE_VERIFIER_CALENDARIO,
      codeVerifier,
      opzioniCookieOAuthCalendario(600)
    );
    return response;
  } catch (errore) {
    if (errore instanceof ErroreAutorizzazione) {
      return NextResponse.json({ errore: errore.message }, { status: errore.statusCode });
    }
    console.error("Errore avvio collegamento calendario Google:", errore);
    return NextResponse.json({ errore: "Errore interno" }, { status: 500 });
  }
}
