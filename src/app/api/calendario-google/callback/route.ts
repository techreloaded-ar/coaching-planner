import { NextResponse, type NextRequest } from "next/server";
import { ErroreAutorizzazione, risolviProfiloCollaboratoreCorrente } from "@/lib/dal";
import { db } from "@/lib/db";
import { scambiaCodiceCalendario } from "@/lib/calendario-google";
import { cifraToken } from "@/lib/cifratura-token";
import {
  COOKIE_CODE_VERIFIER_CALENDARIO,
  COOKIE_STATE_CALENDARIO,
  opzioniCookieOAuthCalendario,
} from "../cookie-oauth";

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * GET /api/calendario-google/callback
 *
 * Ritorno dal consenso Google. Salva il token di rinnovo, cifrato, sul
 * collaboratore della sessione corrente e torna all'area attività con l'esito
 * in `?calendario=collegato|negato`. Consenso negato, state errato o assente e
 * scambio fallito non salvano nulla.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const code = params.get("code");
  const stateAtteso = request.cookies.get(COOKIE_STATE_CALENDARIO)?.value;
  const codeVerifier = request.cookies.get(COOKIE_CODE_VERIFIER_CALENDARIO)?.value;

  try {
    const profilo = await risolviProfiloCollaboratoreCorrente();
    if (profilo.stato !== "ATTIVO") {
      return esito("negato");
    }

    if (params.get("error") || !code || !state || !stateAtteso || !codeVerifier || state !== stateAtteso) {
      return esito("negato");
    }

    const refreshToken = await scambiaCodiceCalendario(code, codeVerifier);
    if (!refreshToken) {
      return esito("negato");
    }

    const refreshTokenCifrato = cifraToken(refreshToken);
    await db.collegamentoCalendarioGoogle.upsert({
      where: { collaboratoreId: profilo.collaboratore.id },
      update: { refreshTokenCifrato },
      create: { collaboratoreId: profilo.collaboratore.id, refreshTokenCifrato },
    });

    return esito("collegato");
  } catch (errore) {
    if (errore instanceof ErroreAutorizzazione) {
      return NextResponse.json({ errore: errore.message }, { status: errore.statusCode });
    }
    console.error("Errore callback calendario Google:", errore);
    return esito("negato");
  }
}

function esito(valore: "collegato" | "negato"): NextResponse {
  const response = NextResponse.redirect(
    new URL(`/attivita?calendario=${valore}`, baseUrl())
  );
  response.cookies.set(COOKIE_STATE_CALENDARIO, "", opzioniCookieOAuthCalendario(0));
  response.cookies.set(COOKIE_CODE_VERIFIER_CALENDARIO, "", opzioniCookieOAuthCalendario(0));
  return response;
}
