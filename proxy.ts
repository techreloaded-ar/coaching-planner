import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import type { PayloadSessione } from "@/lib/session";
import { DURATA_SESSIONE_ORE } from "@/lib/session";
import { rinnovaToken } from "@/lib/rinnova-token";
import { ruoloRichiestoPerRotta, homePerRuolo } from "@/lib/policy-rotte";

const NOME_COOKIE = "cp_sessione";

// ── Rotte pubbliche (mai reindirizzate) ─────────────────────────

const ROTTE_PUBBLICHE = ["/login", "/api/auth/google", "/api/e2e-test"];

function isPubblica(pathname: string): boolean {
  return ROTTE_PUBBLICHE.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
}

// ── Decrittazione ottimistica (solo cookie, senza DB) ───────────

async function decrittazionaSessione(
  token: string
): Promise<PayloadSessione | null> {
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret === "changeme-change-me-change-me-change-me") {
      // In sviluppo senza secret, non blocchiamo ma non validiamo
      return null;
    }

    const chiave = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify<PayloadSessione>(token, chiave, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    return null;
  }
}

// ── Proxy ───────────────────────────────────────────────────────

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 1. Rotte pubbliche: non reindirizzare mai
  if (isPubblica(pathname)) {
    const response = NextResponse.next();

    // Se già autenticato e su /login, reindirizza all'area del ruolo
    if (pathname === "/login" || pathname.startsWith("/login?")) {
      const token = request.cookies.get(NOME_COOKIE)?.value;
      if (token) {
        const sessione = await decrittazionaSessione(token);
        if (sessione) {
          return NextResponse.redirect(
            new URL(homePerRuolo(sessione.ruolo), request.url)
          );
        }
      }
    }

    return response;
  }

  // 2. Rotte protette: verifica presenza sessione
  const token = request.cookies.get(NOME_COOKIE)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const sessione = await decrittazionaSessione(token);

  if (!sessione) {
    // Cookie presente ma non valido → puliscilo e redirect
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(NOME_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  // 3. Check ottimistico di ruolo: se la rotta richiede un ruolo
  //    diverso da quello in sessione, reindirizza all'area corretta.
  //    Solo lettura del JWT, senza query al DB.
  const ruoloRichiesto = ruoloRichiestoPerRotta(pathname);
  if (ruoloRichiesto && sessione.ruolo !== ruoloRichiesto) {
    return NextResponse.redirect(
      new URL(homePerRuolo(sessione.ruolo), request.url)
    );
  }

  // 4. Rinnovo sliding della scadenza con nuova firma JWT
  const response = NextResponse.next();
  const nuovoToken = await rinnovaToken(token);

  if (nuovoToken) {
    response.cookies.set(NOME_COOKIE, nuovoToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: DURATA_SESSIONE_ORE * 3600,
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
