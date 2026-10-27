import { NextResponse, type NextRequest } from "next/server";
import { ErroreAutorizzazione, risolviProfiloCollaboratoreCorrente, richiediSessioneApi } from "@/lib/dal";
import { db } from "@/lib/db";
import { scambiaCodiceCalendario } from "@/lib/calendario-google";
import { cifraToken } from "@/lib/cifratura-token";
import { stessoAccountGoogle } from "@/domain/calendario-google";
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
 * in `?calendario=collegato|negato|account-diverso`. Consenso negato, state
 * errato o assente, scambio fallito e account Google diverso da quello di
 * accesso non salvano nulla: un collegamento esistente resta invariato.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const code = params.get("code");
  const stateAtteso = request.cookies.get(COOKIE_STATE_CALENDARIO)?.value;
  const codeVerifier = request.cookies.get(COOKIE_CODE_VERIFIER_CALENDARIO)?.value;

  try {
    const sessione = await richiediSessioneApi();
    const profilo = await risolviProfiloCollaboratoreCorrente(sessione);
    if (profilo.stato !== "ATTIVO") {
      return esito("negato");
    }

    if (params.get("error") || !code || !state || !stateAtteso || !codeVerifier || state !== stateAtteso) {
      return esito("negato");
    }

    const consenso = await scambiaCodiceCalendario(code, codeVerifier);
    if (!consenso) {
      return esito("negato");
    }

    if (!stessoAccountGoogle(consenso.emailAutorizzata, sessione.email)) {
      return esito("account-diverso");
    }

    const refreshTokenCifrato = cifraToken(consenso.refreshToken);
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

function esito(valore: "collegato" | "negato" | "account-diverso"): NextResponse {
  const response = NextResponse.redirect(
    new URL(`/attivita?calendario=${valore}`, baseUrl())
  );
  response.cookies.set(COOKIE_STATE_CALENDARIO, "", opzioniCookieOAuthCalendario(0));
  response.cookies.set(COOKIE_CODE_VERIFIER_CALENDARIO, "", opzioniCookieOAuthCalendario(0));
  return response;
}
