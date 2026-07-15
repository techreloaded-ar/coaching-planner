export const DURATA_SESSIONE_ORE = 8;
export const DURATA_SESSIONE_SECONDI = DURATA_SESSIONE_ORE * 3600;
export const NOME_COOKIE_SESSIONE = "cp_sessione";
export const SESSION_SECRET_PLACEHOLDER =
  "changeme-change-me-change-me-change-me";
export const LUNGHEZZA_MINIMA_SESSION_SECRET = 32;

export const MESSAGGIO_ERRORE_SESSION_SECRET =
  "SESSION_SECRET non valida: imposta una chiave sicura di almeno 32 caratteri, non vuota e diversa dal placeholder predefinito.";

export class ErroreSessionSecretNonValida extends Error {
  constructor() {
    super(MESSAGGIO_ERRORE_SESSION_SECRET);
    this.name = "ErroreSessionSecretNonValida";
  }
}

export function validaSessionSecret(
  secret: string | null | undefined = process.env.SESSION_SECRET
): string {
  if (typeof secret !== "string") {
    throw new ErroreSessionSecretNonValida();
  }

  const secretNormalizzato = secret.trim();

  if (
    secretNormalizzato.length === 0 ||
    secretNormalizzato === SESSION_SECRET_PLACEHOLDER ||
    secretNormalizzato.length < LUNGHEZZA_MINIMA_SESSION_SECRET
  ) {
    throw new ErroreSessionSecretNonValida();
  }

  return secretNormalizzato;
}

export function chiaveSessioneSegreta(): Uint8Array {
  return new TextEncoder().encode(validaSessionSecret());
}

export function calcolaScadenzaSessione(
  now = Math.floor(Date.now() / 1000)
): number {
  return now + DURATA_SESSIONE_SECONDI;
}

export function dataScadenzaSessione(expiresAt: number): Date {
  return new Date(expiresAt * 1000);
}

function opzioniBaseCookieSessione() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function opzioniCookieSessione(expiresAt: Date) {
  return {
    ...opzioniBaseCookieSessione(),
    expires: expiresAt,
  };
}

export function opzioniEliminazioneCookieSessione() {
  return {
    ...opzioniBaseCookieSessione(),
    maxAge: 0,
  };
}
