import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { scambiaCodice } from "@/lib/google-oauth";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import type { Ruolo } from "@/domain/types";
import { homePerRuolo } from "@/lib/policy-rotte";

// ── URL base ────────────────────────────────────────────────────

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

// ── GET /api/auth/google/callback ───────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();

  try {
    // 1. Leggi state e codeVerifier dai cookie di breve durata
    const savedState = cookieStore.get("google_oauth_state")?.value;
    const codeVerifier = cookieStore.get("google_oauth_code_verifier")?.value;

    if (!savedState || !codeVerifier) {
      return redirectWithError();
    }

    // 2. Valida il state contro il query param
    const url = request.nextUrl;
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Google OAuth error:", error);
      return redirectWithError();
    }

    if (!code || !state) {
      return redirectWithError();
    }

    if (state !== savedState) {
      return redirectWithError();
    }

    // 3. Scambia il codice con i token e recupera il profilo
    // (La pulizia dei cookie OAuth temporanei avviene esclusivamente via
    //  response.cookies.set(..., maxAge: 0) nei rami di successo ed errore.)
    const risultato = await scambiaCodice(code, codeVerifier);

    if (!risultato) {
      return redirectWithError();
    }

    const { profilo } = risultato;

    // 4. Verifica email verificata
    if (!profilo.email_verified) {
      return redirectWithError();
    }

    // 5. Cerca l'utente per email
    const utente = await db.utente.findUnique({
      where: { email: profilo.email },
      select: {
        id: true,
        ruolo: true,
        nome: true,
        email: true,
        collaboratore: { select: { attivo: true } },
      },
    });

    if (!utente) {
      // Email non censita → accesso negato, messaggio generico
      return redirectWithError();
    }

    if (
      utente.ruolo === "COLLABORATORE" &&
      utente.collaboratore &&
      utente.collaboratore.attivo === false
    ) {
      // Collaboratore disattivato → accesso negato, stesso messaggio generico
      return redirectWithError();
    }

    // 6. Upsert dell'Account (provider google)
    await db.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: profilo.sub,
        },
      },
      update: {
        access_token: risultato.accessToken,
      },
      create: {
        userId: utente.id,
        type: "oauth",
        provider: "google",
        providerAccountId: profilo.sub,
        access_token: risultato.accessToken,
      },
    });

    // 7. Crea la sessione
    await createSession(
      utente.id,
      utente.ruolo as Ruolo,
      utente.nome,
      utente.email
    );

    // 8. Reindirizza all'area del ruolo
    const destinazione = homePerRuolo(utente.ruolo as Ruolo);
    const response = NextResponse.redirect(new URL(destinazione, baseUrl()));

    // Pulisci eventuali cookie OAuth residui
    response.cookies.set("google_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    response.cookies.set("google_oauth_code_verifier", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    console.error("Errore callback Google:", err);
    return redirectWithError();
  }
}

// ── Helper ──────────────────────────────────────────────────────

function redirectWithError(): NextResponse {
  // Messaggio generico verso l'esterno, il dettaglio è solo per i log
  const response = NextResponse.redirect(
    new URL("/login?error=1", baseUrl())
  );

  // Pulisci i cookie OAuth anche in caso di errore
  response.cookies.set("google_oauth_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("google_oauth_code_verifier", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
