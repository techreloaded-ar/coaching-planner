import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ErroreSessionSecretNonValida,
  MESSAGGIO_ERRORE_SESSION_SECRET,
  validaSessionSecret,
} from "@/lib/session-config";
import { register } from "@/instrumentation";

let sessionSecretOriginale = process.env.SESSION_SECRET;

describe("session-config", () => {
  beforeEach(() => {
    sessionSecretOriginale = process.env.SESSION_SECRET;
  });

  afterEach(() => {
    if (sessionSecretOriginale === undefined) {
      delete process.env.SESSION_SECRET;
      return;
    }

    process.env.SESSION_SECRET = sessionSecretOriginale;
  });

  it("rifiuta SESSION_SECRET mancante", () => {
    delete process.env.SESSION_SECRET;

    expect(() => validaSessionSecret()).toThrowError(
      ErroreSessionSecretNonValida
    );
    expect(() => validaSessionSecret()).toThrowError(
      MESSAGGIO_ERRORE_SESSION_SECRET
    );
  });

  it.each(["", "   ", "changeme-change-me-change-me-change-me", "troppo-corta"])(
    "rifiuta SESSION_SECRET non valida: %s",
    (secret) => {
      expect(() => validaSessionSecret(secret)).toThrowError(
        ErroreSessionSecretNonValida
      );
      expect(() => validaSessionSecret(secret)).toThrowError(
        MESSAGGIO_ERRORE_SESSION_SECRET
      );
    }
  );

  it("accetta e normalizza una SESSION_SECRET valida", () => {
    expect(
      validaSessionSecret("  chiave-di-test-lunga-almeno-32-caratteri-!!  ")
    ).toBe("chiave-di-test-lunga-almeno-32-caratteri-!!");
  });

  it("register fallisce subito con il placeholder", () => {
    process.env.SESSION_SECRET = "changeme-change-me-change-me-change-me";

    expect(() => register()).toThrowError(ErroreSessionSecretNonValida);
  });

  it("register completa senza errori con un secret valido", () => {
    process.env.SESSION_SECRET =
      "chiave-di-test-lunga-almeno-32-caratteri-!!";

    expect(() => register()).not.toThrow();
  });
});
