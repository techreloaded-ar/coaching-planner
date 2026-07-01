import { describe, it, expect } from "vitest";
import { ruoloRichiestoPerRotta, homePerRuolo } from "@/lib/policy-rotte";

// ── Mappatura percorso → ruolo ──────────────────────────────────

describe("ruoloRichiestoPerRotta — back office", () => {
  it("restituisce AMMINISTRATORE per /anagrafiche", () => {
    expect(ruoloRichiestoPerRotta("/anagrafiche")).toBe("AMMINISTRATORE");
  });

  it("restituisce AMMINISTRATORE per un sottopercorso di /anagrafiche", () => {
    expect(ruoloRichiestoPerRotta("/anagrafiche/123")).toBe("AMMINISTRATORE");
  });

  it("restituisce AMMINISTRATORE per /offerte", () => {
    expect(ruoloRichiestoPerRotta("/offerte")).toBe("AMMINISTRATORE");
  });

  it("restituisce AMMINISTRATORE per /collaboratori", () => {
    expect(ruoloRichiestoPerRotta("/collaboratori")).toBe("AMMINISTRATORE");
  });

  it("restituisce AMMINISTRATORE per /report", () => {
    expect(ruoloRichiestoPerRotta("/report")).toBe("AMMINISTRATORE");
  });
});

describe("ruoloRichiestoPerRotta — front office", () => {
  it("restituisce COLLABORATORE per /attivita", () => {
    expect(ruoloRichiestoPerRotta("/attivita")).toBe("COLLABORATORE");
  });

  it("restituisce COLLABORATORE per un sottopercorso di /attivita", () => {
    expect(ruoloRichiestoPerRotta("/attivita/2025-06")).toBe("COLLABORATORE");
  });
});

describe("ruoloRichiestoPerRotta — rotte neutre", () => {
  it("restituisce null per /login", () => {
    expect(ruoloRichiestoPerRotta("/login")).toBeNull();
  });

  it("restituisce null per /api/auth/google", () => {
    expect(ruoloRichiestoPerRotta("/api/auth/google")).toBeNull();
  });

  it("restituisce null per /api/auth/google/callback", () => {
    expect(ruoloRichiestoPerRotta("/api/auth/google/callback")).toBeNull();
  });

  it("restituisce null per la home /", () => {
    expect(ruoloRichiestoPerRotta("/")).toBeNull();
  });

  it("restituisce null per favicon.ico", () => {
    expect(ruoloRichiestoPerRotta("/favicon.ico")).toBeNull();
  });
});

// ── homePerRuolo ────────────────────────────────────────────────

describe("homePerRuolo", () => {
  it("restituisce /anagrafiche per AMMINISTRATORE", () => {
    expect(homePerRuolo("AMMINISTRATORE")).toBe("/anagrafiche");
  });

  it("restituisce /attivita per COLLABORATORE", () => {
    expect(homePerRuolo("COLLABORATORE")).toBe("/attivita");
  });
});
