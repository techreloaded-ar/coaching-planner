import { describe, expect, it } from "vitest";
import {
  validaCensimentoUtente,
  validaModificaUtente,
  type DatiCensimentoUtenteInput,
  type DatiModificaUtenteInput,
} from "@/domain/anagrafiche/valida-utente";

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

function baseModificaInput(
  overrides: Partial<DatiModificaUtenteInput> = {}
): DatiModificaUtenteInput {
  return {
    nome: "Mario Rossi",
    email: "mario.rossi@example.com",
    ruoloAmministratore: false,
    ruoloCollaboratore: true,
    cognome: "Rossi",
    partitaIva: "12345678901",
    tariffaGiornaliera: "650,00",
    profiloPresente: false,
    ...overrides,
  };
}

describe("validaCensimentoUtente", () => {
  // ── (a) Le tre combinazioni valide di ruoli ─────────────────────

  it("rifiuta il cognome mancante anche con solo l'amministratore selezionato", () => {
    const errori = validaCensimentoUtente(
      baseCensimentoInput({
        ruoloAmministratore: true,
        ruoloCollaboratore: false,
        cognome: "",
        partitaIva: "",
        tariffaGiornaliera: "",
      })
    );
    expect(errori.cognome).toBe("Il cognome è obbligatorio");
  });

  it("accetta solo amministratore con cognome valorizzato e senza campi profilo", () => {
    expect(
      validaCensimentoUtente(
        baseCensimentoInput({
          ruoloAmministratore: true,
          ruoloCollaboratore: false,
          cognome: "Bianchi",
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

  it("non segnala errori sui campi profilo (ma segnala il cognome mancante) quando è selezionato solo l'amministratore", () => {
    const errori = validaCensimentoUtente(
      baseCensimentoInput({
        ruoloAmministratore: true,
        ruoloCollaboratore: false,
        cognome: "",
        partitaIva: "",
        tariffaGiornaliera: "",
      })
    );
    expect(errori.cognome).toBe("Il cognome è obbligatorio");
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

describe("validaModificaUtente", () => {
  // ── (a) Caso valido: solo amministratore, profilo assente ───────

  it("rifiuta il cognome mancante anche con solo l'amministratore selezionato e profilo assente", () => {
    const errori = validaModificaUtente(
      baseModificaInput({
        ruoloAmministratore: true,
        ruoloCollaboratore: false,
        profiloPresente: false,
        cognome: "",
        partitaIva: "",
        tariffaGiornaliera: "",
      })
    );
    expect(errori.cognome).toBe("Il cognome è obbligatorio");
  });

  it("accetta solo amministratore con cognome valorizzato, profilo assente e campi profilo vuoti", () => {
    expect(
      validaModificaUtente(
        baseModificaInput({
          ruoloAmministratore: true,
          ruoloCollaboratore: false,
          profiloPresente: false,
          cognome: "Bianchi",
          partitaIva: "",
          tariffaGiornaliera: "",
        })
      )
    ).toEqual({});
  });

  // ── (b) Nessun ruolo selezionato ────────────────────────────────

  it("rifiuta l'assenza di ruoli", () => {
    const errori = validaModificaUtente(
      baseModificaInput({
        ruoloAmministratore: false,
        ruoloCollaboratore: false,
      })
    );
    expect(errori.ruoli).toBe("Seleziona almeno un ruolo");
  });

  // ── (c) Collaboratore con profilo assente: campi obbligatori ────

  it("rifiuta i campi profilo vuoti quando il Collaboratore è selezionato e il profilo è assente", () => {
    const errori = validaModificaUtente(
      baseModificaInput({
        ruoloCollaboratore: true,
        profiloPresente: false,
        cognome: "",
        partitaIva: "",
        tariffaGiornaliera: "",
      })
    );
    expect(errori.cognome).toBe("Il cognome è obbligatorio");
    expect(errori.partitaIva).toBe("La partita IVA è obbligatoria");
    expect(errori.tariffaGiornaliera).toBe(
      "La tariffa giornaliera è obbligatoria"
    );
  });

  // ── (d) Collaboratore con profilo presente: campi ignorati ──────

  it("segnala il cognome mancante ma non i campi profilo quando il Collaboratore è selezionato e il profilo è già presente", () => {
    const errori = validaModificaUtente(
      baseModificaInput({
        ruoloCollaboratore: true,
        profiloPresente: true,
        cognome: "",
        partitaIva: "",
        tariffaGiornaliera: "",
      })
    );
    expect(errori.cognome).toBe("Il cognome è obbligatorio");
    expect(errori.partitaIva).toBeUndefined();
    expect(errori.tariffaGiornaliera).toBeUndefined();
  });

  it("non segnala errori quando il Collaboratore è selezionato, il profilo è già presente e il cognome è valorizzato", () => {
    const errori = validaModificaUtente(
      baseModificaInput({
        ruoloCollaboratore: true,
        profiloPresente: true,
        cognome: "Bianchi",
        partitaIva: "",
        tariffaGiornaliera: "",
      })
    );
    expect(errori.cognome).toBeUndefined();
    expect(errori.partitaIva).toBeUndefined();
    expect(errori.tariffaGiornaliera).toBeUndefined();
  });

  // ── (e) Nome ed email validati come in validaUtente ─────────────

  it.each(["", "   "])("rifiuta il nome mancante %#", (nome) => {
    expect(validaModificaUtente(baseModificaInput({ nome })).nome).toBe(
      "Il nome è obbligatorio"
    );
  });

  it.each(["senza-chiocciola", "spazi @dominio"])(
    "rifiuta l'email non valida %s",
    (email) => {
      expect(validaModificaUtente(baseModificaInput({ email })).email).toBe(
        "Inserisci un indirizzo email valido"
      );
    }
  );
});
