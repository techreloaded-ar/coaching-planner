import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import type { Ruolo } from "@/domain/types";

/**
 * POST /api/__test/sessione
 * 
 * Endpoint riservato ai test e2e: crea una sessione diretta per un utente
 * esistente a DB, simulando il completamento del flusso OAuth Google.
 * 
 * Attivo solo quando E2E_TEST_MODE=true.
 * Richiede in body JSON: { email: string }
 */
export async function POST(request: NextRequest) {
  if (process.env.E2E_TEST_MODE !== "true") {
    return NextResponse.json(
      { error: "Endpoint disponibile solo in modalità test e2e" },
      { status: 403 }
    );
  }

  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email richiesta" }, { status: 400 });
    }

    const utente = await db.utente.findUnique({
      where: { email },
      select: { id: true, ruolo: true, nome: true, email: true },
    });

    if (!utente) {
      return NextResponse.json(
        { error: "Utente non trovato" },
        { status: 404 }
      );
    }

    // Garantisce un account Google fittizio per i test.
    // createMany + skipDuplicates evita errori di concorrenza quando più
    // worker Playwright autenticano lo stesso utente in parallelo.
    await db.account.createMany({
      data: [
        {
          userId: utente.id,
          type: "oauth",
          provider: "google",
          providerAccountId: `test-${utente.id}`,
        },
      ],
      skipDuplicates: true,
    });

    await createSession(
      utente.id,
      utente.ruolo as Ruolo,
      utente.nome,
      utente.email
    );

    const destinazione =
      utente.ruolo === "AMMINISTRATORE" ? "/anagrafiche" : "/attivita";

    return NextResponse.json({ ok: true, redirect: destinazione });
  } catch (error) {
    console.error("Errore test session:", error);
    return NextResponse.json(
      { error: "Errore interno" },
      { status: 500 }
    );
  }
}
