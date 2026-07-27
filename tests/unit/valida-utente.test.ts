import { describe, expect, it } from "vitest";
import {
  validaCensimentoUtente,
  validaUtente,
  type DatiCensimentoUtenteInput,
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

function baseCensimentoInput(
  overrides: Partial<DatiCensimentoUtenteInput> = {}
): DatiCensimentoUtenteInput {
  return {
    nome: "Mario Rossi",
    email: "mario.rossi@example.com",
    ruoloAmministratore: false,
    ruoloCollaboratore: true,
    cognome: "Rossi",
    partitaIva: "12345678901",
    tariffaGiornaliera: "650,00",
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

describe("validaCensimentoUtente", () => {
  // ── (a) Le tre combinazioni valide di ruoli ─────────────────────

  it("accetta solo amministratore senza campi profilo valorizzati", () => {
    expect(
      validaCensimentoUtente(
        baseCensimentoInput({
          ruoloAmministratore: true,
          ruoloCollaboratore: false,
          cognome: "",
          partitaIva: "",
          tariffaGiornaliera: "",
        })
      )
    ).toEqual({});
  });

  it("accetta solo collaboratore con cognome, partita IVA e tariffa validi", () => {
    expect(
      validaCensimentoUtente(
        baseCensimentoInput({
          ruoloAmministratore: false,
          ruoloCollaboratore: true,
        })
      )
    ).toEqual({});
  });

  it("accetta entrambi i ruoli con cognome, partita IVA e tariffa validi", () => {
    expect(
      validaCensimentoUtente(
        baseCensimentoInput({
          ruoloAmministratore: true,
          ruoloCollaboratore: true,
        })
      )
    ).toEqual({});
  });

  // ── (b) Nessun ruolo selezionato ────────────────────────────────

  it("rifiuta l'assenza di ruoli", () => {
    const errori = validaCensimentoUtente(
      baseCensimentoInput({
        ruoloAmministratore: false,
        ruoloCollaboratore: false,
      })
    );
    expect(errori.ruoli).toBe("Seleziona almeno un ruolo");
  });

  // ── (c) Cognome obbligatorio con ruolo Collaboratore ────────────

  it.each(["", "   "])(
    "rifiuta il cognome vuoto quando il ruolo Collaboratore è selezionato %#",
    (cognome) => {
      const errori = validaCensimentoUtente(
        baseCensimentoInput({ cognome })
      );
      expect(errori.cognome).toBe("Il cognome è obbligatorio");
    }
  );

  // ── (d) Partita IVA — parità con validaCollaboratore ────────────

  it("rifiuta la partita IVA vuota con lo stesso messaggio di validaCollaboratore", () => {
    const errori = validaCensimentoUtente(
      baseCensimentoInput({ partitaIva: "" })
    );
    expect(errori.partitaIva).toBe("La partita IVA è obbligatoria");
  });

  it.each(["1234567890", "123456789012", "1234567890A"])(
    "rifiuta la partita IVA non di 11 cifre con lo stesso messaggio di validaCollaboratore %s",
    (partitaIva) => {
      const errori = validaCensimentoUtente(
        baseCensimentoInput({ partitaIva })
      );
      expect(errori.partitaIva).toBe(
        "La partita IVA deve essere di 11 cifre"
      );
    }
  );

  // ── (e) Tariffa giornaliera — parità con validaCollaboratore ────

  it("rifiuta la tariffa vuota con lo stesso messaggio di validaCollaboratore", () => {
    const errori = validaCensimentoUtente(
      baseCensimentoInput({ tariffaGiornaliera: "" })
    );
    expect(errori.tariffaGiornaliera).toBe(
      "La tariffa giornaliera è obbligatoria"
    );
  });

  it("rifiuta la tariffa con più di 2 decimali con lo stesso messaggio di validaCollaboratore", () => {
    const errori = validaCensimentoUtente(
      baseCensimentoInput({ tariffaGiornaliera: "10,999" })
    );
    expect(errori.tariffaGiornaliera).toBe(
      "Importo non valido: usa massimo 2 decimali"
    );
  });

  it("rifiuta la tariffa pari a zero con lo stesso messaggio di validaCollaboratore", () => {
    const errori = validaCensimentoUtente(
      baseCensimentoInput({ tariffaGiornaliera: "0" })
    );
    expect(errori.tariffaGiornaliera).toBe(
      "La tariffa giornaliera deve essere maggiore di zero"
    );
  });

  // ── (f) Solo amministratore ignora i campi profilo ──────────────

  it("non segnala errori sui campi profilo quando è selezionato solo l'amministratore", () => {
    const errori = validaCensimentoUtente(
      baseCensimentoInput({
        ruoloAmministratore: true,
        ruoloCollaboratore: false,
        cognome: "",
        partitaIva: "",
        tariffaGiornaliera: "",
      })
    );
    expect(errori.cognome).toBeUndefined();
    expect(errori.partitaIva).toBeUndefined();
    expect(errori.tariffaGiornaliera).toBeUndefined();
  });

  // ── (g) Nome ed email validati come in validaUtente ─────────────

  it.each(["", "   "])("rifiuta il nome mancante %#", (nome) => {
    expect(validaCensimentoUtente(baseCensimentoInput({ nome })).nome).toBe(
      "Il nome è obbligatorio"
    );
  });

  it.each(["", "   "])("rifiuta l'email mancante %#", (email) => {
    expect(
      validaCensimentoUtente(baseCensimentoInput({ email })).email
    ).toBe("L'email di accesso è obbligatoria");
  });

  it.each(["senza-chiocciola", "spazi @dominio"])(
    "rifiuta l'email non valida %s",
    (email) => {
      expect(
        validaCensimentoUtente(baseCensimentoInput({ email })).email
      ).toBe("Inserisci un indirizzo email valido");
    }
  );

  it("accetta un'email valida", () => {
    expect(
      validaCensimentoUtente(
        baseCensimentoInput({ email: "anna.verdi@example.com" })
      ).email
    ).toBeUndefined();
  });
});
