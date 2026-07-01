import { describe, it, expect } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { DURATA_SESSIONE_ORE } from "@/lib/session";
import type { PayloadSessione } from "@/lib/session";

// ── Helpers di crittografia ─────────────────────────────────────

const chiave = new TextEncoder().encode("chiave-di-test-lunga-almeno-32-caratteri-!!");

async function encrypt(payload: PayloadSessione): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURATA_SESSIONE_ORE}h`)
    .sign(chiave);
}

async function decrypt(token: string): Promise<PayloadSessione | null> {
  try {
    const { payload } = await jwtVerify<PayloadSessione>(token, chiave, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    return null;
  }
}

describe("session — crittografia roundtrip", () => {
  const payload: PayloadSessione = {
    utenteId: "abc-123",
    ruolo: "AMMINISTRATORE",
    nome: "Test User",
    email: "test@example.com",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };

  it("encrypt + decrypt restituisce il payload originale", async () => {
    const token = await encrypt(payload);
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");

    const decoded = await decrypt(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.utenteId).toBe(payload.utenteId);
    expect(decoded!.ruolo).toBe(payload.ruolo);
    expect(decoded!.nome).toBe(payload.nome);
    expect(decoded!.email).toBe(payload.email);
  });
});

describe("session — token scaduto", () => {
  it("restituisce null per un token scaduto", async () => {
    const now = Math.floor(Date.now() / 1000);
    const expiredPayload: PayloadSessione = {
      utenteId: "scaduto-1",
      ruolo: "COLLABORATORE",
      nome: "Expired",
      email: "expired@test.local",
      expiresAt: now - 3600,
    };

    // Creiamo un token già scaduto impostando exp nel passato
    const token = await new SignJWT({ ...expiredPayload })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("0s") // scade subito
      .sign(chiave);

    // Attendiamo un attimo per essere certi che il token sia scaduto
    await new Promise((r) => setTimeout(r, 1100));

    const decoded = await decrypt(token);
    expect(decoded).toBeNull();
  });
});

describe("session — token manomesso", () => {
  const altraChiave = new TextEncoder().encode(
    "un-altra-chiave-diversa-per-test-manomissione!"
  );

  it("restituisce null con una chiave diversa", async () => {
    const payload: PayloadSessione = {
      utenteId: "man-1",
      ruolo: "AMMINISTRATORE",
      nome: "Tampered",
      email: "tampered@test.local",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };

    const token = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(altraChiave);

    const decoded = await decrypt(token);
    expect(decoded).toBeNull();
  });

  it("restituisce null per una stringa casuale", async () => {
    const decoded = await decrypt("questa-non-è-una-stringa-jwt-valida");
    expect(decoded).toBeNull();
  });
});
