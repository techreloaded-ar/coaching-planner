import "server-only";

import { Google, generateCodeVerifier, generateState } from "arctic";

// ── Configurazione ──────────────────────────────────────────────

function clientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id || id === "tuo-client-id.apps.googleusercontent.com") {
    throw new Error(
      "GOOGLE_CLIENT_ID non configurato. Imposta le credenziali OAuth in .env.local."
    );
  }
  return id;
}

function clientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret || secret === "tuo-client-secret") {
    throw new Error(
      "GOOGLE_CLIENT_SECRET non configurato. Imposta le credenziali OAuth in .env.local."
    );
  }
  return secret;
}

function redirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    "http://localhost:3000/api/auth/google/callback"
  );
}

// ── Client arctic ───────────────────────────────────────────────

const google = new Google(clientId(), clientSecret(), redirectUri());

// ── Interfacce ──────────────────────────────────────────────────

export interface ProfiloGoogle {
  sub: string;
  email: string;
  email_verified: boolean;
  nome: string;
}

// ── API pubbliche ───────────────────────────────────────────────

/**
 * Genera l'URL di autorizzazione Google con stato OAuth (state + code verifier).
 * Il chiamante deve salvare state e codeVerifier in un cookie per validarli al callback.
 */
export async function urlAutorizzazione(): Promise<{
  url: string;
  state: string;
  codeVerifier: string;
}> {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, codeVerifier, [
    "openid",
    "email",
    "profile",
  ]);

  return { url: url.toString(), state, codeVerifier };
}

/**
 * Scambia il codice di autorizzazione con i token e recupera il profilo Google.
 * Restituisce `null` se lo scambio fallisce (codice scaduto o non valido).
 */
export async function scambiaCodice(
  code: string,
  codeVerifier: string
): Promise<{ accessToken: string; profilo: ProfiloGoogle } | null> {
  try {
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);
    const accessToken = tokens.accessToken();

    const profilo = await recuperaProfilo(accessToken);
    return { accessToken, profilo };
  } catch {
    return null;
  }
}

/**
 * Recupera il profilo utente da Google UserInfo endpoint.
 * Incapsulato per consentire lo stub nei test e2e.
 */
export async function recuperaProfilo(
  accessToken: string
): Promise<ProfiloGoogle> {
  const res = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    throw new Error(`Google UserInfo ha risposto con ${res.status}`);
  }

  const data = await res.json();

  return {
    sub: data.sub as string,
    email: data.email as string,
    email_verified: Boolean(data.email_verified ?? data.verified_email ?? true),
    nome: (data.name as string) || "Utente Google",
  };
}
