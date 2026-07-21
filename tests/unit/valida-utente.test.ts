import { describe, expect, it } from "vitest";
import {
  validaUtente,
  type DatiUtenteInput,
} from "@/domain/anagrafiche/valida-utente";

function baseInput(
  overrides: Partial<DatiUtenteInput> = {}
): DatiUtenteInput {
  return {
    nome: "Mario Rossi",
    email: "mario.rossi@example.com",
    ruolo: "COLLABORATORE",
    ...overrides,
  };
}

describe("validaUtente", () => {
  it("restituisce un oggetto vuoto per dati validi", () => {
    expect(validaUtente(baseInput())).toEqual({});
  });

  it.each(["", "   "])("rifiuta il nome mancante %#", (nome) => {
    expect(validaUtente(baseInput({ nome })).nome).toBe(
      "Il nome è obbligatorio"
    );
  });

  it.each(["", "   "])("rifiuta l'email mancante %#", (email) => {
    expect(validaUtente(baseInput({ email })).email).toBe(
      "L'email di accesso è obbligatoria"
    );
  });

  it.each(["senza-chiocciola", "spazi @dominio"])(
    "rifiuta l'email non valida %s",
    (email) => {
      expect(validaUtente(baseInput({ email })).email).toBe(
        "Inserisci un indirizzo email valido"
      );
    }
  );

  it("accetta un'email valida", () => {
    expect(
      validaUtente(baseInput({ email: "anna.verdi@example.com" })).email
    ).toBeUndefined();
  });

  it("rifiuta il ruolo mancante", () => {
    expect(validaUtente(baseInput({ ruolo: "" })).ruolo).toBe(
      "Seleziona un ruolo valido"
    );
  });

  it("rifiuta un ruolo fuori enum", () => {
    expect(validaUtente(baseInput({ ruolo: "SUPERVISORE" })).ruolo).toBe(
      "Seleziona un ruolo valido"
    );
  });

  it.each(["AMMINISTRATORE", "COLLABORATORE"])(
    "accetta il ruolo %s",
    (ruolo) => {
      expect(validaUtente(baseInput({ ruolo })).ruolo).toBeUndefined();
    }
  );
});
