import { NextResponse, type NextRequest } from "next/server";
import {
  HOME_AUTENTICATA,
  type PoliticaAccesso,
  politicaAccessoPerRotta,
} from "@/lib/policy-rotte";
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
  politicaAccesso: PoliticaAccesso | null;
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

  if (
    classificazione.politicaAccesso === "AMMINISTRATORE" &&
    sessione.payload.ruolo !== "AMMINISTRATORE"
  ) {
    return applicaRinnovo(
      NextResponse.redirect(new URL(HOME_AUTENTICATA, request.url)),
      sessione
    );
  }

  return applicaRinnovo(NextResponse.next(), sessione);
}

function classificaRichiesta(pathname: string): ClassificazioneRichiesta {
  if (pathname === "/") {
    return { tipo: "root", politicaAccesso: null };
  }

  if (pathname === "/login") {
    return { tipo: "login-tombstone", politicaAccesso: null };
  }

  if (pathname === "/api/auth/google" || pathname.startsWith("/api/auth/google/")) {
    return { tipo: "auth-public", politicaAccesso: null };
  }

  if (pathname === "/api/e2e-test" || pathname.startsWith("/api/e2e-test/")) {
    return { tipo: "e2e-public", politicaAccesso: null };
  }

  return {
    tipo: "protected",
    politicaAccesso: politicaAccessoPerRotta(pathname),
  };
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
