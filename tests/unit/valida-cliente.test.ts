import { describe, it, expect } from "vitest";
import { validaCliente, type DatiClienteInput } from "@/domain/anagrafiche/valida-cliente";

// ── Helper: crea un input minimo valido ────────────────────────

function baseInput(overrides: Partial<DatiClienteInput> = {}): DatiClienteInput {
  return {
    ragioneSociale: "Azienda Test S.r.l.",
    partitaIva: "12345678901",
    ...overrides,
  };
}

// ── 1. Campi obbligatori ───────────────────────────────────────

describe("validaCliente — campi obbligatori", () => {
  describe("ragioneSociale", () => {
    it("restituisce errore se ragioneSociale è vuota", () => {
      const errori = validaCliente(baseInput({ ragioneSociale: "" }));
      expect(errori.ragioneSociale).toBe("La ragione sociale è obbligatoria");
    });

    it("restituisce errore se ragioneSociale è composta solo da spazi", () => {
      const errori = validaCliente(baseInput({ ragioneSociale: "   " }));
      expect(errori.ragioneSociale).toBe("La ragione sociale è obbligatoria");
    });

    it("non segnala errore su ragioneSociale se valorizzata", () => {
      const errori = validaCliente(baseInput({ ragioneSociale: "Acme S.p.A." }));
      expect(errori.ragioneSociale).toBeUndefined();
    });
  });

  describe("partitaIva", () => {
    it("restituisce errore se partitaIva è vuota", () => {
      const errori = validaCliente(baseInput({ partitaIva: "" }));
      expect(errori.partitaIva).toBe("La partita IVA è obbligatoria");
    });

    it("restituisce errore se partitaIva è composta solo da spazi", () => {
      const errori = validaCliente(baseInput({ partitaIva: "   " }));
      expect(errori.partitaIva).toBe("La partita IVA è obbligatoria");
    });

    it("non segnala errore su partitaIva se valorizzata con 11 cifre", () => {
      const errori = validaCliente(baseInput({ partitaIva: "98765432109" }));
      expect(errori.partitaIva).toBeUndefined();
    });
  });

  it("non segnala errori quando entrambi i campi obbligatori sono presenti", () => {
    const errori = validaCliente(baseInput());
    expect(errori).toEqual({});
  });
});

// ── 2. Partita IVA — formato ──────────────────────────────────

describe("validaCliente — formato partita IVA", () => {
  it("accetta 11 cifre", () => {
    const errori = validaCliente(baseInput({ partitaIva: "12345678901" }));
    expect(errori.partitaIva).toBeUndefined();
  });

  it("rifiuta 10 cifre", () => {
    const errori = validaCliente(baseInput({ partitaIva: "1234567890" }));
    expect(errori.partitaIva).toBe("La partita IVA deve essere di 11 cifre");
  });

  it("rifiuta 12 cifre", () => {
    const errori = validaCliente(baseInput({ partitaIva: "123456789012" }));
    expect(errori.partitaIva).toBe("La partita IVA deve essere di 11 cifre");
  });

  it("rifiuta se contiene lettere", () => {
    const errori = validaCliente(baseInput({ partitaIva: "1234567890A" }));
    expect(errori.partitaIva).toBe("La partita IVA deve essere di 11 cifre");
  });
});

// ── 3. Codice Fiscale (opzionale) ─────────────────────────────

describe("validaCliente — codice fiscale (opzionale)", () => {
  it("non segnala errore se vuoto", () => {
    const errori = validaCliente(baseInput({ codiceFiscale: "" }));
    expect(errori.codiceFiscale).toBeUndefined();
  });

  it("non segnala errore se assente", () => {
    const input = baseInput();
    delete input.codiceFiscale;
    const errori = validaCliente(input);
    expect(errori.codiceFiscale).toBeUndefined();
  });

  it("accetta 11 cifre (codice fiscale numerico)", () => {
    const errori = validaCliente(baseInput({ codiceFiscale: "12345678901" }));
    expect(errori.codiceFiscale).toBeUndefined();
  });

  it("accetta 16 caratteri alfanumerici", () => {
    const errori = validaCliente(baseInput({ codiceFiscale: "RSSMRA80A01H501U" }));
    expect(errori.codiceFiscale).toBeUndefined();
  });

  it("rifiuta 10 cifre", () => {
    const errori = validaCliente(baseInput({ codiceFiscale: "1234567890" }));
    expect(errori.codiceFiscale).toBe(
      "Codice fiscale non valido: 11 cifre o 16 caratteri alfanumerici"
    );
  });

  it("rifiuta 15 caratteri alfanumerici", () => {
    const errori = validaCliente(baseInput({ codiceFiscale: "RSSMRA80A01H501" }));
    expect(errori.codiceFiscale).toBe(
      "Codice fiscale non valido: 11 cifre o 16 caratteri alfanumerici"
    );
  });
});

// ── 4. CAP (opzionale) ────────────────────────────────────────

describe("validaCliente — CAP (opzionale)", () => {
  it("non segnala errore se vuoto", () => {
    const errori = validaCliente(baseInput({ cap: "" }));
    expect(errori.cap).toBeUndefined();
  });

  it("non segnala errore se assente", () => {
    const input = baseInput();
    delete input.cap;
    const errori = validaCliente(input);
    expect(errori.cap).toBeUndefined();
  });

  it("accetta esattamente 5 cifre", () => {
    const errori = validaCliente(baseInput({ cap: "20121" }));
    expect(errori.cap).toBeUndefined();
  });

  it("rifiuta 4 cifre", () => {
    const errori = validaCliente(baseInput({ cap: "2012" }));
    expect(errori.cap).toBe("Il CAP è di 5 cifre");
  });

  it("rifiuta 6 cifre", () => {
    const errori = validaCliente(baseInput({ cap: "201211" }));
    expect(errori.cap).toBe("Il CAP è di 5 cifre");
  });

  it("rifiuta se contiene lettere", () => {
    const errori = validaCliente(baseInput({ cap: "20A21" }));
    expect(errori.cap).toBe("Il CAP è di 5 cifre");
  });
});

// ── 5. Provincia (opzionale) ──────────────────────────────────

describe("validaCliente — provincia (opzionale)", () => {
  it("non segnala errore se vuota", () => {
    const errori = validaCliente(baseInput({ provincia: "" }));
    expect(errori.provincia).toBeUndefined();
  });

  it("non segnala errore se assente", () => {
    const input = baseInput();
    delete input.provincia;
    const errori = validaCliente(input);
    expect(errori.provincia).toBeUndefined();
  });

  it("accetta esattamente 2 lettere", () => {
    const errori = validaCliente(baseInput({ provincia: "MI" }));
    expect(errori.provincia).toBeUndefined();
  });

  it("accetta 2 lettere minuscole (case-insensitive)", () => {
    const errori = validaCliente(baseInput({ provincia: "mi" }));
    expect(errori.provincia).toBeUndefined();
  });

  it("rifiuta 1 lettera", () => {
    const errori = validaCliente(baseInput({ provincia: "M" }));
    expect(errori.provincia).toBe("Sigla di 2 lettere (es. MI)");
  });

  it("rifiuta 3 lettere", () => {
    const errori = validaCliente(baseInput({ provincia: "MIL" }));
    expect(errori.provincia).toBe("Sigla di 2 lettere (es. MI)");
  });
});

// ── 6. PEC (opzionale) ────────────────────────────────────────

describe("validaCliente — PEC (opzionale)", () => {
  it("non segnala errore se vuota", () => {
    const errori = validaCliente(baseInput({ pec: "" }));
    expect(errori.pec).toBeUndefined();
  });

  it("non segnala errore se assente", () => {
    const input = baseInput();
    delete input.pec;
    const errori = validaCliente(input);
    expect(errori.pec).toBeUndefined();
  });

  it("accetta un indirizzo email valido", () => {
    const errori = validaCliente(baseInput({ pec: "cliente@pec.azienda.it" }));
    expect(errori.pec).toBeUndefined();
  });

  it("rifiuta se manca la @", () => {
    const errori = validaCliente(baseInput({ pec: "clientepec.azienda.it" }));
    expect(errori.pec).toBe("Inserisci un indirizzo PEC valido");
  });

  it("rifiuta se manca il dominio dopo la @", () => {
    const errori = validaCliente(baseInput({ pec: "cliente@" }));
    expect(errori.pec).toBe("Inserisci un indirizzo PEC valido");
  });
});

// ── 7. Codice Destinatario / SDI (opzionale) ──────────────────

describe("validaCliente — codice destinatario / SDI (opzionale)", () => {
  it("non segnala errore se vuoto", () => {
    const errori = validaCliente(baseInput({ codiceDestinatario: "" }));
    expect(errori.codiceDestinatario).toBeUndefined();
  });

  it("non segnala errore se assente", () => {
    const input = baseInput();
    delete input.codiceDestinatario;
    const errori = validaCliente(input);
    expect(errori.codiceDestinatario).toBeUndefined();
  });

  it("accetta esattamente 7 caratteri alfanumerici", () => {
    const errori = validaCliente(baseInput({ codiceDestinatario: "ABC1234" }));
    expect(errori.codiceDestinatario).toBeUndefined();
  });

  it("rifiuta 6 caratteri", () => {
    const errori = validaCliente(baseInput({ codiceDestinatario: "ABC123" }));
    expect(errori.codiceDestinatario).toBe(
      "Il codice SDI è di 7 caratteri alfanumerici"
    );
  });

  it("rifiuta 8 caratteri", () => {
    const errori = validaCliente(baseInput({ codiceDestinatario: "ABC12345" }));
    expect(errori.codiceDestinatario).toBe(
      "Il codice SDI è di 7 caratteri alfanumerici"
    );
  });
});

// ── 8. Record completamente valido ────────────────────────────

describe("validaCliente — record completamente valido", () => {
  it("restituisce oggetto vuoto quando tutti i campi obbligatori sono presenti e tutti gli opzionali sono vuoti", () => {
    const errori = validaCliente(
      baseInput({
        codiceFiscale: "",
        cap: "",
        provincia: "",
        pec: "",
        codiceDestinatario: "",
      })
    );
    expect(errori).toEqual({});
  });

  it("restituisce oggetto vuoto quando tutti i campi (inclusi opzionali) sono validi", () => {
    const errori = validaCliente(
      baseInput({
        codiceFiscale: "RSSMRA80A01H501U",
        indirizzo: "Via Roma 1",
        citta: "Milano",
        cap: "20121",
        provincia: "MI",
        pec: "cliente@pec.azienda.it",
        codiceDestinatario: "AB12CD3",
      })
    );
    expect(errori).toEqual({});
  });
});

// ── 9. Casi edge ──────────────────────────────────────────────

describe("validaCliente — casi edge", () => {
  it("restituisce più errori contemporaneamente", () => {
    const errori = validaCliente(
      baseInput({
        ragioneSociale: "",
        partitaIva: "ABC",
        cap: "123",
        pec: "non-valida",
      })
    );
    expect(errori.ragioneSociale).toBe("La ragione sociale è obbligatoria");
    expect(errori.partitaIva).toBe("La partita IVA deve essere di 11 cifre");
    expect(errori.cap).toBe("Il CAP è di 5 cifre");
    expect(errori.pec).toBe("Inserisci un indirizzo PEC valido");
  });
});
