import { NextResponse, type NextRequest } from "next/server";
import {
  NOME_COOKIE_SESSIONE,
  dataScadenzaSessione,
  opzioniCookieSessione,
  opzioniEliminazioneCookieSessione,
} from "@/lib/session-config";
import {
  type RisultatoVerificaERinnovoSessione,
  verificaERinnovaTokenSessione,
  verificaTokenSessione,
} from "@/lib/session-token";

type TipoRichiesta =
  | "root"
  | "login-tombstone"
  | "auth-public"
  | "e2e-public"
  | "protected";

interface ClassificazioneRichiesta {
  tipo: TipoRichiesta;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const classificazione = classificaRichiesta(pathname);
  const token = request.cookies.get(NOME_COOKIE_SESSIONE)?.value;

  if (!token) {
    return classificazione.tipo === "protected"
      ? redirectAllaRadice(request)
      : NextResponse.next();
  }

  if (classificazione.tipo === "root") {
    const sessione = await verificaERinnovaTokenSessione(token);
    if (!sessione) {
      return pulisciCookie(NextResponse.next());
    }

    return applicaRinnovo(NextResponse.next(), sessione);
  }

  if (classificazione.tipo !== "protected") {
    const sessione = await verificaTokenSessione(token);
    return sessione ? NextResponse.next() : pulisciCookie(NextResponse.next());
  }

  const sessione = await verificaERinnovaTokenSessione(token);

  if (!sessione) {
    return pulisciCookie(redirectAllaRadice(request));
  }

  return applicaRinnovo(NextResponse.next(), sessione);
}

function classificaRichiesta(pathname: string): ClassificazioneRichiesta {
  if (pathname === "/") {
    return { tipo: "root" };
  }

  if (pathname === "/login") {
    return { tipo: "login-tombstone" };
  }

  if (pathname === "/api/auth/google" || pathname.startsWith("/api/auth/google/")) {
    return { tipo: "auth-public" };
  }

  if (pathname === "/api/e2e-test" || pathname.startsWith("/api/e2e-test/")) {
    return { tipo: "e2e-public" };
  }

  return { tipo: "protected" };
}

function applicaRinnovo(
  response: NextResponse,
  sessione: RisultatoVerificaERinnovoSessione
): NextResponse {
  response.cookies.set(
    NOME_COOKIE_SESSIONE,
    sessione.token,
    opzioniCookieSessione(dataScadenzaSessione(sessione.payload.expiresAt))
  );

  return response;
}

function pulisciCookie(response: NextResponse): NextResponse {
  response.cookies.set(
    NOME_COOKIE_SESSIONE,
    "",
    opzioniEliminazioneCookieSessione()
  );

  return response;
}

function redirectAllaRadice(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
