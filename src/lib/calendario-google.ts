import "server-only";

import { decodeIdToken, Google } from "arctic";
import { clientId, clientSecret } from "@/lib/google-oauth";
import {
  finestraRichiestaGiorno,
  type EventoGoogle,
} from "@/domain/calendario-google";

// Integrazione con Google Calendar in sola lettura: consenso OAuth separato dal
// login, scambio del codice per il token di rinnovo e lettura degli eventi del
// calendario principale.
//
// Con E2E_TEST_MODE=true Google non viene mai contattato: il consenso passa da
// una pagina locale che sceglie l'account e torna al callback con il codice
// `e2e-consenso:<email autorizzata>` (o con `error` se negato), e gli
// eventi sono letti dal token di test scritto da /api/e2e-test/calendario-google
// (formato `e2e:<json>`).

export const SCOPE_CALENDARIO_SOLA_LETTURA =
  "https://www.googleapis.com/auth/calendar.readonly";

export const PERCORSO_CALLBACK_CALENDARIO = "/api/calendario-google/callback";

const PREFISSO_TOKEN_E2E = "e2e:";

/** Pagina del consenso simulato, dove si sceglie l'account da «autorizzare». */
export const PERCORSO_CONSENSO_SIMULATO = "/e2e-test/consenso-calendario";

/** Prefisso del codice di consenso simulato: segue l'email dell'account autorizzato. */
export const PREFISSO_CODICE_CONSENSO_E2E = "e2e-consenso:";

const TIMEOUT_CALENDARIO_MS = 10000;

/** Token di test di un calendario collegato senza eventi. */
export const REFRESH_TOKEN_E2E_SENZA_EVENTI = `${PREFISSO_TOKEN_E2E}{"eventi":[]}`;

function modalitaTestE2e(): boolean {
  return process.env.E2E_TEST_MODE === "true";
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function clientCalendario(): Google {
  return new Google(
    clientId(),
    clientSecret(),
    new URL(PERCORSO_CALLBACK_CALENDARIO, baseUrl()).toString()
  );
}

/**
 * URL del consenso Google per la sola lettura del calendario.
 *
 * `access_type=offline` + `prompt=consent` garantiscono il token di rinnovo
 * anche quando il collaboratore ha già autorizzato l'app in passato;
 * `select_account` forza la scelta esplicita dell'account, suggerito da
 * `login_hint`. Gli scope `openid` ed `email` servono a ricavare l'account
 * autorizzato dall'id_token.
 */
export function urlConsensoCalendario(
  state: string,
  codeVerifier: string,
  emailCollaboratore: string
): string {
  if (modalitaTestE2e()) {
    const url = new URL(PERCORSO_CONSENSO_SIMULATO, baseUrl());
    url.searchParams.set("state", state);
    url.searchParams.set("login_hint", emailCollaboratore);
    return url.toString();
  }

  const url = clientCalendario().createAuthorizationURL(state, codeVerifier, [
    "openid",
    "email",
    SCOPE_CALENDARIO_SOLA_LETTURA,
  ]);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("login_hint", emailCollaboratore);
  return url.toString();
}

/** Esito di uno scambio riuscito: token di rinnovo ed email dell'account autorizzato. */
export interface ConsensoCalendario {
  refreshToken: string;
  emailAutorizzata: string;
}

/**
 * Scambia il codice del consenso con il token di rinnovo e l'email
 * dell'account Google autorizzato, letta dall'id_token.
 *
 * Restituisce `null` se lo scambio fallisce, se Google non rilascia un token di
 * rinnovo o l'email, o se il collaboratore ha deselezionato il permesso sul
 * calendario.
 */
export async function scambiaCodiceCalendario(
  code: string,
  codeVerifier: string
): Promise<ConsensoCalendario | null> {
  if (modalitaTestE2e()) {
    if (!code.startsWith(PREFISSO_CODICE_CONSENSO_E2E)) return null;
    return {
      refreshToken: REFRESH_TOKEN_E2E_SENZA_EVENTI,
      emailAutorizzata: code.slice(PREFISSO_CODICE_CONSENSO_E2E.length),
    };
  }

  try {
    const tokens = await clientCalendario().validateAuthorizationCode(
      code,
      codeVerifier
    );
    if (!tokens.hasRefreshToken()) return null;
    if (!tokens.scopes().includes(SCOPE_CALENDARIO_SOLA_LETTURA)) return null;
    // L'id_token arriva direttamente dal token endpoint di Google via TLS:
    // non serve verificarne la firma per leggerne l'email.
    const { email, email_verified: emailVerificata } = decodeIdToken(
      tokens.idToken()
    ) as { email?: unknown; email_verified?: unknown };
    if (typeof email !== "string" || !email || emailVerificata !== true) return null;
    return { refreshToken: tokens.refreshToken(), emailAutorizzata: email };
  } catch (errore) {
    console.error("Scambio del codice del calendario Google non riuscito:", errore);
    return null;
  }
}

/**
 * Eventi del calendario principale attorno alla giornata `YYYY-MM-DD`.
 *
 * Lancia se il token non è più valido o se Google non risponde: il chiamante
 * lo traduce nell'avviso «ricollega il calendario».
 */
export async function eventiAttornoAlGiorno(
  refreshToken: string,
  giorno: string
): Promise<EventoGoogle[]> {
  if (modalitaTestE2e()) {
    return eventiDaTokenE2e(refreshToken);
  }

  const tokens = await clientCalendario().refreshAccessToken(refreshToken);
  const { timeMin, timeMax } = finestraRichiestaGiorno(giorno);
  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events"
  );
  url.search = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  }).toString();

  const risposta = await fetch(url, {
    headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_CALENDARIO_MS),
  });

  if (!risposta.ok) {
    throw new Error(`Google Calendar ha risposto con ${risposta.status}`);
  }

  const dati = (await risposta.json()) as { items?: EventoGoogle[] };
  return dati.items ?? [];
}

/** Codifica gli eventi simulati nel token di test (solo E2E_TEST_MODE). */
export function refreshTokenE2e(contenuto: {
  eventi?: EventoGoogle[];
  errore?: boolean;
}): string {
  return `${PREFISSO_TOKEN_E2E}${JSON.stringify(contenuto)}`;
}

function eventiDaTokenE2e(refreshToken: string): EventoGoogle[] {
  if (!refreshToken.startsWith(PREFISSO_TOKEN_E2E)) {
    throw new Error("Token di test non valido");
  }
  const contenuto = JSON.parse(refreshToken.slice(PREFISSO_TOKEN_E2E.length)) as {
    eventi?: EventoGoogle[];
    errore?: boolean;
  };
  if (contenuto.errore) {
    throw new Error("Google Calendar simulato non disponibile");
  }
  return contenuto.eventi ?? [];
}
