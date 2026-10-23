import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cifraToken } from "@/lib/cifratura-token";
import { refreshTokenE2e } from "@/lib/calendario-google";
import type { EventoGoogle } from "@/domain/calendario-google";

/**
 * POST /api/e2e-test/calendario-google
 *
 * Endpoint riservato ai test e2e: collega al collaboratore dell'email indicata
 * un calendario Google simulato con gli eventi forniti (formato Calendar API
 * v3), oppure un calendario illeggibile con `errore: true`.
 *
 * Attivo solo quando E2E_TEST_MODE=true.
 * Body JSON: { email: string, eventi?: EventoGoogle[], errore?: boolean }
 */
export async function POST(request: NextRequest) {
  if (process.env.E2E_TEST_MODE !== "true") {
    return NextResponse.json(
      { error: "Endpoint disponibile solo in modalità test e2e" },
      { status: 403 }
    );
  }

  const { email, eventi, errore } = (await request.json()) as {
    email?: unknown;
    eventi?: EventoGoogle[];
    errore?: boolean;
  };

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email richiesta" }, { status: 400 });
  }

  const collaboratore = await db.collaboratore.findFirst({
    where: { utente: { email } },
    select: { id: true },
  });

  if (!collaboratore) {
    return NextResponse.json({ error: "Collaboratore non trovato" }, { status: 404 });
  }

  const refreshTokenCifrato = cifraToken(
    refreshTokenE2e({ eventi: eventi ?? [], errore: errore === true })
  );
  await db.collegamentoCalendarioGoogle.upsert({
    where: { collaboratoreId: collaboratore.id },
    update: { refreshTokenCifrato },
    create: { collaboratoreId: collaboratore.id, refreshTokenCifrato },
  });

  return NextResponse.json({ ok: true });
}
