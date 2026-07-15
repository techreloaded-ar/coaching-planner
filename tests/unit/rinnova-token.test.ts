import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SignJWT, decodeJwt } from "jose";
import { rinnovaToken } from "@/lib/rinnova-token";
import { DURATA_SESSIONE_SECONDI } from "@/lib/session-config";

const SESSION_SECRET_VALIDA =
  "chiave-di-test-lunga-almeno-32-caratteri-!!";

let sessionSecretOriginale = process.env.SESSION_SECRET;

describe("rinnovaToken", () => {
  beforeEach(() => {
    sessionSecretOriginale = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = SESSION_SECRET_VALIDA;
  });

  afterEach(() => {
    if (sessionSecretOriginale === undefined) {
      delete process.env.SESSION_SECRET;
      return;
    }

    process.env.SESSION_SECRET = sessionSecretOriginale;
  });

  it("restituisce un nuovo token con exp ed expiresAt aggiornati", async () => {
    const issuedAt = 1_700_000_000;
    const renewedAt = issuedAt + 300;
    const originale = await creaTokenValido({
      now: issuedAt,
      ruolo: "AMMINISTRATORE",
    });

    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(renewedAt * 1000);

    try {
      const rinnovato = await rinnovaToken(originale);

      expect(rinnovato).not.toBeNull();
      expect(rinnovato).not.toBe(originale);

      const claims = decodeJwt(rinnovato!) as {
        utenteId: string;
        ruolo: string;
        nome: string;
        email: string;
        expiresAt: number;
        exp: number;
        iat: number;
      };

      expect(claims.utenteId).toBe("user-1");
      expect(claims.ruolo).toBe("AMMINISTRATORE");
      expect(claims.expiresAt).toBe(renewedAt + DURATA_SESSIONE_SECONDI);
      expect(claims.exp).toBe(claims.expiresAt);
      expect(claims.iat).toBe(renewedAt);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("restituisce null per un token scaduto", async () => {
    const now = 1_700_000_000;
    const token = await new SignJWT({
      utenteId: "expired-1",
      ruolo: "AMMINISTRATORE",
      nome: "Expired",
      email: "expired@example.com",
      expiresAt: now - 10,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 100)
      .setExpirationTime(now - 10)
      .sign(new TextEncoder().encode(SESSION_SECRET_VALIDA));

    const risultato = await rinnovaToken(token);
    expect(risultato).toBeNull();
  });

  it("restituisce null per una stringa non JWT", async () => {
    const risultato = await rinnovaToken("stringa-non-jwt-valida");
    expect(risultato).toBeNull();
  });

  it("restituisce null per un token firmato con chiave diversa", async () => {
    const now = 1_700_000_000;
    const token = await new SignJWT({
      utenteId: "alien-1",
      ruolo: "COLLABORATORE",
      nome: "Alien",
      email: "alien@example.com",
      expiresAt: now + DURATA_SESSIONE_SECONDI,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + DURATA_SESSIONE_SECONDI)
      .sign(
        new TextEncoder().encode(
          "altra-chiave-diversa-per-test-firma-errata!"
        )
      );

    const risultato = await rinnovaToken(token);
    expect(risultato).toBeNull();
  });
});

async function creaTokenValido({
  now,
  ruolo,
}: {
  now: number;
  ruolo: "AMMINISTRATORE" | "COLLABORATORE";
}) {
  return new SignJWT({
    utenteId: "user-1",
    ruolo,
    nome: "Test User",
    email: "test@example.com",
    expiresAt: now + DURATA_SESSIONE_SECONDI,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + DURATA_SESSIONE_SECONDI)
    .sign(new TextEncoder().encode(SESSION_SECRET_VALIDA));
}
