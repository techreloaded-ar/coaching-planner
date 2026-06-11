import { NextResponse } from "next/server";
import { urlAutorizzazione } from "@/lib/google-oauth";

/**
 * GET /api/auth/google
 * Avvia il flusso OAuth Google: genera state e codeVerifier,
 * li salva in cookie httpOnly di breve durata,
 * e reindirizza all'URL di autorizzazione Google.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { url, state, codeVerifier } = await urlAutorizzazione();

    const response = NextResponse.redirect(url);

    // Cookie di breve durata per validare il callback (10 minuti)
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minuti
    });

    response.cookies.set("google_oauth_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    return response;
  } catch (error) {
    console.error("Errore avvio login Google:", error);
    return NextResponse.redirect(
      new URL("/login?error=1", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
    );
  }
}
