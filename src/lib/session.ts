import "server-only";

import { cookies } from "next/headers";
import type { PayloadSessione, Ruolo } from "@/domain/types";
import {
  NOME_COOKIE_SESSIONE,
  dataScadenzaSessione,
  opzioniCookieSessione,
  opzioniEliminazioneCookieSessione,
} from "@/lib/session-config";
import {
  creaTokenSessione,
  verificaERinnovaTokenSessione,
  verificaTokenSessione,
} from "@/lib/session-token";

export type { PayloadSessione } from "@/domain/types";
export { DURATA_SESSIONE_ORE, NOME_COOKIE_SESSIONE } from "@/lib/session-config";

export async function createSession(
  utenteId: string,
  ruolo: Ruolo,
  nome: string,
  email: string
): Promise<void> {
  const { payload, token } = await creaTokenSessione({
    utenteId,
    ruolo,
    nome,
    email,
  });
  const cookieStore = await cookies();

  cookieStore.set(
    NOME_COOKIE_SESSIONE,
    token,
    opzioniCookieSessione(dataScadenzaSessione(payload.expiresAt))
  );
}

export async function updateSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(NOME_COOKIE_SESSIONE)?.value;

  if (!token) {
    return;
  }

  const sessione = await verificaERinnovaTokenSessione(token);

  if (!sessione) {
    return;
  }

  cookieStore.set(
    NOME_COOKIE_SESSIONE,
    sessione.token,
    opzioniCookieSessione(dataScadenzaSessione(sessione.payload.expiresAt))
  );
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    NOME_COOKIE_SESSIONE,
    "",
    opzioniEliminazioneCookieSessione()
  );
}

export async function getSessionCookie(): Promise<PayloadSessione | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(NOME_COOKIE_SESSIONE)?.value;

  if (!token) {
    return null;
  }

  return verificaTokenSessione(token);
}
