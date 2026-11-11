import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SignJWT, decodeJwt } from "jose";
import type { PayloadSessione } from "@/domain/types";
import { DURATA_SESSIONE_SECONDI } from "@/lib/session-config";
import {
  creaTokenSessione,
  verificaERinnovaTokenSessione,
  verificaTokenSessione,
} from "@/lib/session-token";

const SESSION_SECRET_VALIDA =
  "chiave-di-test-lunga-almeno-32-caratteri-!!";

let sessionSecretOriginale = process.env.SESSION_SECRET;

describe("session-token", () => {
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

  it("crea e verifica una sessione con claim coerenti", async () => {
    const now = 1_700_000_000;

    const sessione = await creaTokenSessione(
      {
        utenteId: "abc-123",
        nome: "Test User",
        email: "test@example.com",
      },
      { now }
    );

    expect(sessione.payload.expiresAt).toBe(now + DURATA_SESSIONE_SECONDI);

    const payload = await verificaTokenSessione(sessione.token, { now });
    expect(payload).toEqual(sessione.payload);

    const claims = decodeJwt(sessione.token) as PayloadSessione & {
      exp: number;
      iat: number;
    };

    expect(claims.iat).toBe(now);
    expect(claims.exp).toBe(now + DURATA_SESSIONE_SECONDI);
    expect(claims.expiresAt).toBe(claims.exp);
  });

  it("rinnova la sessione in modo deterministico", async () => {
    const issuedAt = 1_700_000_000;
    const renewedAt = issuedAt + 600;
    const originale = await creaTokenSessione(
      {
        utenteId: "user-2",
        nome: "Collab",
        email: "collab@example.com",
      },
      { now: issuedAt }
    );

    const rinnovata = await verificaERinnovaTokenSessione(originale.token, {
      now: renewedAt,
    });

    expect(rinnovata).not.toBeNull();
    expect(rinnovata!.token).not.toBe(originale.token);
    expect(rinnovata!.payload).toEqual({
      ...originale.payload,
      expiresAt: renewedAt + DURATA_SESSIONE_SECONDI,
    });

    const payload = await verificaTokenSessione(rinnovata!.token, {
      now: renewedAt,
    });
    expect(payload).toEqual(rinnovata!.payload);
  });

  it("rifiuta token firmati ma con claim malformati", async () => {
    const now = 1_700_000_000;
    const token = await new SignJWT({
      utenteId: "",
      nome: "Broken",
      email: "broken@example.com",
      expiresAt: now + DURATA_SESSIONE_SECONDI,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + DURATA_SESSIONE_SECONDI)
      .sign(new TextEncoder().encode(SESSION_SECRET_VALIDA));

    const payload = await verificaTokenSessione(token, { now });
    expect(payload).toBeNull();
  });

  it("accetta e rinnova un token emesso prima della rimozione del ruolo, ignorando il claim", async () => {
    const now = 1_700_000_000;
    const expiresAt = now + DURATA_SESSIONE_SECONDI;
    const token = await firmaTokenLegacy({
      utenteId: "legacy-1",
      ruolo: "AMMINISTRATORE",
      nome: "Legacy",
      email: "legacy@example.com",
      expiresAt,
      iat: now,
    });

    const payload = await verificaTokenSessione(token, { now: now + 60 });
    expect(payload).toEqual({
      utenteId: "legacy-1",
      nome: "Legacy",
      email: "legacy@example.com",
      expiresAt,
    });

    const rinnovata = await verificaERinnovaTokenSessione(token, {
      now: now + 60,
    });
    expect(rinnovata).not.toBeNull();
    expect(decodeJwt(rinnovata!.token)).not.toHaveProperty("ruolo");

    expect(
      await verificaTokenSessione(token, { now: expiresAt + 1 })
    ).toBeNull();
  });

  it("accetta un token con un valore di ruolo non elencato", async () => {
    const now = 1_700_000_000;
    const token = await firmaTokenLegacy({
      utenteId: "futuro-1",
      ruolo: "RUOLO_FUTURO",
      nome: "Futuro",
      email: "futuro@example.com",
      expiresAt: now + DURATA_SESSIONE_SECONDI,
      iat: now,
    });

    const payload = await verificaTokenSessione(token, { now });
    expect(payload).not.toBeNull();
  });

  it("rifiuta token firmati con una chiave diversa", async () => {
    const now = 1_700_000_000;
    const token = await new SignJWT({
      utenteId: "alien-1",
      ruolo: "AMMINISTRATORE",
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

    const payload = await verificaTokenSessione(token, { now });
    expect(payload).toBeNull();
  });
});

async function firmaTokenLegacy({
  iat,
  ...claims
}: {
  utenteId: string;
  ruolo: string;
  nome: string;
  email: string;
  expiresAt: number;
  iat: number;
}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(claims.expiresAt)
    .sign(new TextEncoder().encode(SESSION_SECRET_VALIDA));
}
