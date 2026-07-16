import { describe, expect, it } from "vitest";
import {
  HOME_AUTENTICATA,
  politicaAccessoPerRotta,
} from "@/lib/policy-rotte";

// ── Matrice percorso → policy di accesso ────────────────────────

describe("politicaAccessoPerRotta", () => {
  it.each([
    ["AMMINISTRATORE", "/anagrafiche"],
    ["AMMINISTRATORE", "/anagrafiche/123"],
    ["AMMINISTRATORE", "/offerte"],
    ["AMMINISTRATORE", "/collaboratori"],
    ["AMMINISTRATORE", "/report"],
    ["AMMINISTRATORE", "/report/2025"],
    ["AUTENTICATO", "/attivita"],
    ["AUTENTICATO", "/attivita/2025-06"],
    ["AUTENTICATO", "/rotta-non-classificata"],
  ] as const)("restituisce %s per %s", (politicaAttesa, pathname) => {
    expect(politicaAccessoPerRotta(pathname)).toBe(politicaAttesa);
  });
});

describe("HOME_AUTENTICATA", () => {
  it("indica /attivita come landing comune", () => {
    expect(HOME_AUTENTICATA).toBe("/attivita");
  });
});
