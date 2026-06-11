import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { rinnovaToken } from "@/lib/rinnova-token";
import { DURATA_SESSIONE_ORE } from "@/lib/session";
import type { PayloadSessione } from "@/lib/session";

const CHIAVE_TEST = "chiave-di-test-lunga-almeno-32-caratteri-!!";
const chiave = new TextEncoder().encode(CHIAVE_TEST);

// Imposta SESSION_SECRET prima di ogni test
beforeAll(() => {
  process.env.SESSION_SECRET = CHIAVE_TEST;
});

async function creaToken(payload: Partial<PayloadSessione> & { utenteId: string; ruolo: "AMMINISTRATORE" | "COLLABORATORE" }, expSeconds: string = `${DURATA_SESSIONE_ORE}h`): Promise<string> {
  const fullPayload: PayloadSessione = {
    utenteId: payload.utenteId,
    ruolo: payload.ruolo,
    nome: payload.nome ?? "Test User",
    email: payload.email ?? "test@example.com",
    expiresAt: payload.expiresAt ?? Math.floor(Date.now() / 1000) + DURATA_SESSIONE_ORE * 3600,
  };

  return new SignJWT({ ...fullPayload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expSeconds)
    .sign(chiave);
}

async function decodificaToken(token: string): Promise<PayloadSessione | null> {
  try {
    const { payload } = await jwtVerify<PayloadSessione>(token, chiave, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    return null;
  }
}

describe("rinnovaToken — token valido", () => {
  it("produce un token verificabile che mantiene i campi originali", async () => {
    // Crea un token con expiresAt nel passato (ma JWT exp ancora valido)
    // così la ri-firma produce sicuramente un token testuale diverso
    const pastExpiresAt = Math.floor(Date.now() / 1000) - 3600;
    const originale = await creaToken({
      utenteId: "user-1",
      ruolo: "AMMINISTRATORE",
      nome: "Admin",
      email: "admin@test.local",
      expiresAt: pastExpiresAt,
    });

    const rinnovato = await rinnovaToken(originale);

    expect(rinnovato).not.toBeNull();
    expect(rinnovato).not.toBe(originale); // deve essere un token diverso

    const payload = await decodificaToken(rinnovato!);
    expect(payload).not.toBeNull();
    expect(payload!.utenteId).toBe("user-1");
    expect(payload!.ruolo).toBe("AMMINISTRATORE");
    expect(payload!.nome).toBe("Admin");
    expect(payload!.email).toBe("admin@test.local");
  });

  it("ha exp ed expiresAt strettamente maggiori dell'originale", async () => {
    // expiresAt originale nel passato
    const pastExpiresAt = Math.floor(Date.now() / 1000) - 3600;
    const originale = await creaToken({
      utenteId: "user-2",
      ruolo: "COLLABORATORE",
      nome: "Collab",
      email: "collab@test.local",
      expiresAt: pastExpiresAt,
    });

    const payloadOrig = await decodificaToken(originale);
    expect(payloadOrig).not.toBeNull();

    const rinnovato = await rinnovaToken(originale);
    expect(rinnovato).not.toBeNull();

    const payloadNew = await decodificaToken(rinnovato!);
    expect(payloadNew).not.toBeNull();

    // expiresAt deve essere maggiore
    expect(payloadNew!.expiresAt).toBeGreaterThan(payloadOrig!.expiresAt);

    // expiresAt rinnovato deve essere nel futuro (circa DURATA_SESSIONE_ORE ore da ora)
    const now = Math.floor(Date.now() / 1000);
    expect(payloadNew!.expiresAt).toBeGreaterThan(now);
    expect(payloadNew!.expiresAt).toBeLessThanOrEqual(now + DURATA_SESSIONE_ORE * 3600 + 5);
  });
});

describe("rinnovaToken — token non valido", () => {
  it("restituisce null per un token scaduto", async () => {
    const scaduto = await creaToken(
      {
        utenteId: "expired-1",
        ruolo: "AMMINISTRATORE",
        nome: "Expired",
        email: "expired@test.local",
      },
      "0s" // scade subito
    );

    // Attendiamo per essere certi che il token sia scaduto
    await new Promise((r) => setTimeout(r, 1100));

    const risultato = await rinnovaToken(scaduto);
    expect(risultato).toBeNull();
  });

  it("restituisce null per una stringa casuale (token manomesso)", async () => {
    const risultato = await rinnovaToken("stringa-non-jwt-valida");
    expect(risultato).toBeNull();
  });

  it("restituisce null per un token firmato con chiave diversa", async () => {
    const altraChiave = new TextEncoder().encode(
      "altra-chiave-diversa-per-test-firma-errata!"
    );

    const tokenAlieno = await new SignJWT({
      utenteId: "alien-1",
      ruolo: "AMMINISTRATORE",
      nome: "Alien",
      email: "alien@test.local",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(altraChiave);

    const risultato = await rinnovaToken(tokenAlieno);
    expect(risultato).toBeNull();
  });
});
