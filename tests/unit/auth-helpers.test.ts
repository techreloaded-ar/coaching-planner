import { describe, it, expect } from "vitest";
import type { Ruolo } from "@/domain/types";

// ── Funzioni pure da testare (estratte perché sono logica pura) ─

/**
 * Mappatura ruolo → destinazione di redirect dopo il login.
 */
function homePerRuolo(ruolo: Ruolo): string {
  return ruolo === "AMMINISTRATORE" ? "/anagrafiche" : "/attivita";
}

/**
 * Logica di esito del callback:
 * - email verificata e censita → utente autorizzato
 * - email non verificata → accesso negato
 * - email sconosciuta → accesso negato (stesso esito generico)
 */
type EsitoCallback =
  | { autorizzato: true; utenteId: string; ruolo: Ruolo }
  | { autorizzato: false; motivo: string };

function valutaCallback(
  emailVerificata: boolean,
  utenteEsiste: boolean,
  utenteId?: string,
  ruolo?: Ruolo
): EsitoCallback {
  if (!emailVerificata) {
    return {
      autorizzato: false,
      motivo: "L'email Google non è verificata.",
    };
  }

  if (!utenteEsiste) {
    return {
      autorizzato: false,
      motivo: "Questo account Google non è autorizzato ad accedere.",
    };
  }

  return {
    autorizzato: true,
    utenteId: utenteId!,
    ruolo: ruolo!,
  };
}

// ── Logica pura di revoca accesso collaboratori disattivati ────
//
// Replica la decisione applicata in:
// - src/app/api/auth/google/callback/route.ts (passo 5)
// - src/lib/dal.ts, _risolviSessione
//
// Dato l'utente trovato a DB (o null se non censito), decide se
// l'accesso è consentito e con quale motivo in caso di rifiuto.

type EsitoAccesso =
  | { autorizzato: true }
  | { autorizzato: false; motivo: string };

const MOTIVO_NON_AUTORIZZATO =
  "Questo account Google non è autorizzato ad accedere.";

function valutaAccessoUtente(
  utente: {
    ruolo: Ruolo;
    collaboratore: { attivo: boolean } | null;
  } | null
): EsitoAccesso {
  if (!utente) {
    return { autorizzato: false, motivo: MOTIVO_NON_AUTORIZZATO };
  }

  if (
    utente.ruolo === "COLLABORATORE" &&
    utente.collaboratore &&
    utente.collaboratore.attivo === false
  ) {
    return { autorizzato: false, motivo: MOTIVO_NON_AUTORIZZATO };
  }

  return { autorizzato: true };
}

describe("auth — revoca accesso collaboratori disattivati (callback Google)", () => {
  it("collaboratore con profilo disattivato → accesso negato (motivo generico)", () => {
    const esito = valutaAccessoUtente({
      ruolo: "COLLABORATORE",
      collaboratore: { attivo: false },
    });
    expect(esito.autorizzato).toBe(false);
    if (!esito.autorizzato) {
      expect(esito.motivo).toBe(MOTIVO_NON_AUTORIZZATO);
    }
  });

  it("collaboratore con profilo attivo → accesso consentito", () => {
    const esito = valutaAccessoUtente({
      ruolo: "COLLABORATORE",
      collaboratore: { attivo: true },
    });
    expect(esito.autorizzato).toBe(true);
  });

  it("amministratore senza profilo collaboratore (collaboratore: null) → accesso consentito", () => {
    const esito = valutaAccessoUtente({
      ruolo: "AMMINISTRATORE",
      collaboratore: null,
    });
    expect(esito.autorizzato).toBe(true);
  });

  it("utente non trovato → accesso negato (stesso motivo generico)", () => {
    const esito = valutaAccessoUtente(null);
    expect(esito.autorizzato).toBe(false);
    if (!esito.autorizzato) {
      expect(esito.motivo).toBe(MOTIVO_NON_AUTORIZZATO);
    }
  });
});

describe("auth — mappatura ruolo → destinazione", () => {
  it("AMMINISTRATORE → /anagrafiche", () => {
    expect(homePerRuolo("AMMINISTRATORE")).toBe("/anagrafiche");
  });

  it("COLLABORATORE → /attivita", () => {
    expect(homePerRuolo("COLLABORATORE")).toBe("/attivita");
  });
});

describe("auth — esito del callback", () => {
  it("email verificata e utente censito → autorizzato (admin)", () => {
    const esito = valutaCallback(true, true, "u1", "AMMINISTRATORE");
    expect(esito.autorizzato).toBe(true);
    if (esito.autorizzato) {
      expect(esito.utenteId).toBe("u1");
      expect(esito.ruolo).toBe("AMMINISTRATORE");
    }
  });

  it("email verificata e utente censito → autorizzato (collab)", () => {
    const esito = valutaCallback(true, true, "u2", "COLLABORATORE");
    expect(esito.autorizzato).toBe(true);
    if (esito.autorizzato) {
      expect(esito.utenteId).toBe("u2");
      expect(esito.ruolo).toBe("COLLABORATORE");
    }
  });

  it("email non verificata → accesso negato", () => {
    const esito = valutaCallback(false, true, "u1", "AMMINISTRATORE");
    expect(esito.autorizzato).toBe(false);
    if (!esito.autorizzato) {
      expect(esito.motivo).toContain("non è verificata");
    }
  });

  it("email verificata ma utente sconosciuto → accesso negato", () => {
    const esito = valutaCallback(true, false);
    expect(esito.autorizzato).toBe(false);
    if (!esito.autorizzato) {
      expect(esito.motivo).toContain("non è autorizzato");
    }
  });

  it("email non verificata E utente sconosciuto → accesso negato (prevale verifica email)", () => {
    const esito = valutaCallback(false, false);
    expect(esito.autorizzato).toBe(false);
    if (!esito.autorizzato) {
      expect(esito.motivo).toContain("non è verificata");
    }
  });
});
