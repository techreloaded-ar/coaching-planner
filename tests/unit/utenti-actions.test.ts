import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  utente: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  collaboratore: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
}));
const mockUtente = mockDb.utente;
const mockCollaboratore = mockDb.collaboratore;

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

const { mockRichiediRuoloApi } = vi.hoisted(() => ({
  mockRichiediRuoloApi: vi.fn(),
}));

vi.mock("@/lib/dal", () => ({
  richiediRuoloApi: mockRichiediRuoloApi,
}));

const { mockRevalidatePath } = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import {
  aggiornaUtente,
  creaUtente,
  type StatoAction,
} from "@/app/(back-office)/anagrafiche/utenti/actions";

function statoIniziale(): StatoAction {
  return { errori: {} };
}

function formNuovoUtente(): FormData {
  const formData = new FormData();
  formData.set("nome", "  Laura Bianchi  ");
  formData.set("email", "  LAURA.BIANCHI@EXAMPLE.COM  ");
  formData.set("ruoloAmministratore", "on");
  return formData;
}

function formNuovoUtenteConProfilo(): FormData {
  const formData = new FormData();
  formData.set("nome", "  Mario  ");
  formData.set("email", "  MARIO.ROSSI@EXAMPLE.COM  ");
  formData.set("ruoloAmministratore", "on");
  formData.set("ruoloCollaboratore", "on");
  formData.set("cognome", "  Rossi  ");
  formData.set("partitaIva", "  12345678901  ");
  formData.set("tariffaGiornaliera", "  450,00  ");
  return formData;
}

function formModificaUtente(): FormData {
  const formData = new FormData();
  formData.set("id", "utente-1");
  formData.set("nome", "  Laura Verdi  ");
  formData.set("email", "  LAURA.VERDI@EXAMPLE.COM  ");
  formData.set("ruoloAmministratore", "on");
  return formData;
}

describe("Server Actions utenti", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
    mockDb.$transaction.mockImplementation(
      async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
    );
  });

  describe("creaUtente", () => {
    it("invoca la guardia amministratore e ne propaga gli errori senza accedere al database", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(
        creaUtente(statoIniziale(), formNuovoUtente()),
      ).rejects.toThrow("Accesso negato");

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockUtente.findUnique).not.toHaveBeenCalled();
      expect(mockUtente.create).not.toHaveBeenCalled();
    });

    it("usa la validazione reale e con dati non validi non crea utenti", async () => {
      const formData = new FormData();
      formData.set("nome", "  ");
      formData.set("email", "senza-chiocciola");

      const result = await creaUtente(statoIniziale(), formData);

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(result.errori).toEqual({
        nome: "Il nome è obbligatorio",
        email: "Inserisci un indirizzo email valido",
        ruoli: "Seleziona almeno un ruolo",
      });
      expect(mockUtente.findUnique).not.toHaveBeenCalled();
      expect(mockUtente.create).not.toHaveBeenCalled();
      expect(mockCollaboratore.create).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("senza alcun ruolo selezionato restituisce errore ruoli e non tocca il database", async () => {
      const formData = new FormData();
      formData.set("nome", "  Laura Bianchi  ");
      formData.set("email", "  LAURA.BIANCHI@EXAMPLE.COM  ");

      const result = await creaUtente(statoIniziale(), formData);

      expect(result.errori).toEqual({ ruoli: "Seleziona almeno un ruolo" });
      expect(mockDb.$transaction).not.toHaveBeenCalled();
      expect(mockUtente.findUnique).not.toHaveBeenCalled();
      expect(mockUtente.create).not.toHaveBeenCalled();
      expect(mockCollaboratore.create).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("rifiuta una partita IVA non valida con ruolo Collaboratore senza toccare il database", async () => {
      const formData = formNuovoUtenteConProfilo();
      formData.set("partitaIva", "123");

      const result = await creaUtente(statoIniziale(), formData);

      expect(result.errori).toEqual({
        partitaIva: "La partita IVA deve essere di 11 cifre",
      });
      expect(mockDb.$transaction).not.toHaveBeenCalled();
      expect(mockUtente.findUnique).not.toHaveBeenCalled();
      expect(mockUtente.create).not.toHaveBeenCalled();
      expect(mockCollaboratore.create).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("rifiuta un'email già presente senza scritture", async () => {
      mockUtente.findUnique.mockResolvedValue({ id: "utente-esistente" });

      const result = await creaUtente(statoIniziale(), formNuovoUtente());

      expect(mockUtente.findUnique).toHaveBeenCalledWith({
        where: { email: "laura.bianchi@example.com" },
      });
      expect(result.errori).toEqual({
        email: "Esiste già un utente con questa email",
      });
      expect(mockUtente.create).not.toHaveBeenCalled();
      expect(mockCollaboratore.create).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("con solo il ruolo amministratore crea l'utente senza profilo collaboratore", async () => {
      mockUtente.findUnique.mockResolvedValue(null);
      mockUtente.create.mockResolvedValue({ id: "utente-1" });

      await creaUtente(statoIniziale(), formNuovoUtente());

      expect(mockUtente.create).toHaveBeenCalledWith({
        data: {
          nome: "Laura Bianchi",
          email: "laura.bianchi@example.com",
          ruolo: "AMMINISTRATORE",
        },
      });
      expect(mockCollaboratore.create).not.toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledTimes(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/utenti");
      expect(mockRedirect).toHaveBeenCalledWith(
        "/anagrafiche/utenti?esito=creato",
      );
    });

    it("con entrambi i ruoli crea utente amministratore e profilo collaboratore nella stessa transazione", async () => {
      mockUtente.findUnique.mockResolvedValue(null);
      mockUtente.create.mockResolvedValue({ id: "utente-1" });

      await creaUtente(statoIniziale(), formNuovoUtenteConProfilo());

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
      expect(mockUtente.create).toHaveBeenCalledWith({
        data: {
          nome: "Mario Rossi",
          email: "mario.rossi@example.com",
          ruolo: "AMMINISTRATORE",
        },
      });
      expect(mockCollaboratore.create).toHaveBeenCalledWith({
        data: {
          userId: "utente-1",
          nome: "Mario",
          cognome: "Rossi",
          partitaIva: "12345678901",
          tariffaGiornaliera: "450.00",
          attivo: true,
        },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/utenti");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        "/anagrafiche/collaboratori",
      );
      expect(mockRevalidatePath).toHaveBeenCalledTimes(2);
      expect(mockRedirect).toHaveBeenCalledWith(
        "/anagrafiche/utenti?esito=creato",
      );
    });

    it("con solo il ruolo collaboratore crea utente collaboratore e relativo profilo", async () => {
      mockUtente.findUnique.mockResolvedValue(null);
      mockUtente.create.mockResolvedValue({ id: "utente-2" });
      const formData = formNuovoUtenteConProfilo();
      formData.delete("ruoloAmministratore");

      await creaUtente(statoIniziale(), formData);

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
      expect(mockUtente.create).toHaveBeenCalledWith({
        data: {
          nome: "Mario Rossi",
          email: "mario.rossi@example.com",
          ruolo: "COLLABORATORE",
        },
      });
      expect(mockCollaboratore.create).toHaveBeenCalledWith({
        data: {
          userId: "utente-2",
          nome: "Mario",
          cognome: "Rossi",
          partitaIva: "12345678901",
          tariffaGiornaliera: "450.00",
          attivo: true,
        },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/utenti");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        "/anagrafiche/collaboratori",
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        "/anagrafiche/utenti?esito=creato",
      );
    });

    it("traduce il vincolo unique P2002 in errore email duplicata", async () => {
      mockUtente.findUnique.mockResolvedValue(null);
      mockUtente.create.mockRejectedValue({ code: "P2002" });

      const result = await creaUtente(statoIniziale(), formNuovoUtente());

      expect(result.errori).toEqual({
        email: "Esiste già un utente con questa email",
      });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe("aggiornaUtente", () => {
    it("invoca la guardia amministratore e ne propaga gli errori senza accedere al database", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(
        aggiornaUtente(statoIniziale(), formModificaUtente()),
      ).rejects.toThrow("Accesso negato");

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockDb.$transaction).not.toHaveBeenCalled();
      expect(mockUtente.findUnique).not.toHaveBeenCalled();
      expect(mockUtente.update).not.toHaveBeenCalled();
    });

    it("rifiuta un form senza id", async () => {
      const formData = formModificaUtente();
      formData.delete("id");

      const result = await aggiornaUtente(statoIniziale(), formData);

      expect(result.errori).toEqual({ _form: "ID utente mancante" });
      expect(mockDb.$transaction).not.toHaveBeenCalled();
      expect(mockUtente.findUnique).not.toHaveBeenCalled();
      expect(mockUtente.update).not.toHaveBeenCalled();
    });

    it("restituisce un errore quando l'utente non esiste, senza aprire transazioni", async () => {
      mockUtente.findUnique.mockResolvedValue(null);

      const result = await aggiornaUtente(
        statoIniziale(),
        formModificaUtente(),
      );

      expect(mockUtente.findUnique).toHaveBeenCalledWith({
        where: { id: "utente-1" },
        include: { collaboratore: { select: { attivo: true } } },
      });
      expect(mockDb.$transaction).not.toHaveBeenCalled();
      expect(result.errori).toEqual({ _form: "Utente non trovato" });
      expect(mockUtente.update).not.toHaveBeenCalled();
    });

    it("promuove un utente senza profilo ad amministratore senza toccare il collaboratore", async () => {
      mockUtente.findUnique.mockResolvedValue({
        ruolo: "COLLABORATORE",
        attivo: true,
        collaboratore: null,
      });
      mockUtente.update.mockResolvedValue({ id: "utente-1" });

      await aggiornaUtente(statoIniziale(), formModificaUtente());

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
      expect(mockUtente.count).not.toHaveBeenCalled();
      expect(mockUtente.update).toHaveBeenCalledWith({
        where: { id: "utente-1" },
        data: {
          nome: "Laura Verdi",
          email: "laura.verdi@example.com",
          ruolo: "AMMINISTRATORE",
        },
      });
      expect(mockCollaboratore.create).not.toHaveBeenCalled();
      expect(mockCollaboratore.update).not.toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledTimes(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/utenti");
      expect(mockRevalidatePath).not.toHaveBeenCalledWith(
        "/anagrafiche/collaboratori",
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        "/anagrafiche/utenti?esito=salvato",
      );
    });

    it("AC-6: blocca la retrocessione dell'ultimo amministratore attivo senza scritture", async () => {
      mockUtente.findUnique.mockResolvedValue({
        ruolo: "AMMINISTRATORE",
        attivo: true,
        collaboratore: { attivo: false },
      });
      mockUtente.count.mockResolvedValue(0);
      const formData = formModificaUtente();
      formData.delete("ruoloAmministratore");
      formData.set("ruoloCollaboratore", "on");

      const result = await aggiornaUtente(statoIniziale(), formData);

      expect(mockUtente.count).toHaveBeenCalledWith({
        where: {
          ruolo: "AMMINISTRATORE",
          attivo: true,
          id: { not: "utente-1" },
        },
      });
      expect(result.errori).toEqual({
        _form:
          "Operazione non consentita: è l'ultimo amministratore attivo del sistema",
      });
      expect(mockUtente.update).not.toHaveBeenCalled();
      expect(mockCollaboratore.create).not.toHaveBeenCalled();
      expect(mockCollaboratore.update).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("retrocede un amministratore quando ne resta almeno un altro attivo", async () => {
      mockUtente.findUnique.mockResolvedValue({
        ruolo: "AMMINISTRATORE",
        attivo: true,
        collaboratore: { attivo: true },
      });
      mockUtente.count.mockResolvedValue(1);
      mockUtente.update.mockResolvedValue({ id: "utente-1" });
      const formData = formModificaUtente();
      formData.delete("ruoloAmministratore");
      formData.set("ruoloCollaboratore", "on");

      await aggiornaUtente(statoIniziale(), formData);

      expect(mockUtente.update).toHaveBeenCalledWith({
        where: { id: "utente-1" },
        data: {
          nome: "Laura Verdi",
          email: "laura.verdi@example.com",
          ruolo: "COLLABORATORE",
        },
      });
      expect(mockCollaboratore.create).not.toHaveBeenCalled();
      expect(mockCollaboratore.update).not.toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/utenti");
      expect(mockRedirect).toHaveBeenCalledWith(
        "/anagrafiche/utenti?esito=salvato",
      );
    });

    it("AC-1: crea il profilo collaboratore per un utente che non lo aveva", async () => {
      mockUtente.findUnique.mockResolvedValue({
        ruolo: "AMMINISTRATORE",
        attivo: true,
        collaboratore: null,
      });
      mockUtente.update.mockResolvedValue({ id: "utente-1" });
      const formData = new FormData();
      formData.set("id", "utente-1");
      formData.set("nome", "  Mario  ");
      formData.set("email", "  MARIO.ROSSI@EXAMPLE.COM  ");
      formData.set("ruoloAmministratore", "on");
      formData.set("ruoloCollaboratore", "on");
      formData.set("cognome", "  Rossi  ");
      formData.set("partitaIva", "  12345678901  ");
      formData.set("tariffaGiornaliera", "  450,00  ");

      await aggiornaUtente(statoIniziale(), formData);

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
      expect(mockUtente.update).toHaveBeenCalledWith({
        where: { id: "utente-1" },
        data: {
          nome: "Mario Rossi",
          email: "mario.rossi@example.com",
          ruolo: "AMMINISTRATORE",
        },
      });
      expect(mockCollaboratore.create).toHaveBeenCalledWith({
        data: {
          userId: "utente-1",
          nome: "Mario",
          cognome: "Rossi",
          partitaIva: "12345678901",
          tariffaGiornaliera: "450.00",
          attivo: true,
        },
      });
      expect(mockCollaboratore.update).not.toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/utenti");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        "/anagrafiche/collaboratori",
      );
      expect(mockRevalidatePath).toHaveBeenCalledTimes(2);
      expect(mockRedirect).toHaveBeenCalledWith(
        "/anagrafiche/utenti?esito=salvato",
      );
    });

    it("AC-1: senza profilo e con Collaboratore selezionato ma campi vuoti segnala i tre errori senza scritture", async () => {
      mockUtente.findUnique.mockResolvedValue({
        ruolo: "COLLABORATORE",
        attivo: true,
        collaboratore: null,
      });
      const formData = new FormData();
      formData.set("id", "utente-1");
      formData.set("nome", "  Mario  ");
      formData.set("email", "  MARIO.ROSSI@EXAMPLE.COM  ");
      formData.set("ruoloCollaboratore", "on");

      const result = await aggiornaUtente(statoIniziale(), formData);

      expect(result.errori).toEqual({
        cognome: "Il cognome è obbligatorio",
        partitaIva: "La partita IVA è obbligatoria",
        tariffaGiornaliera: "La tariffa giornaliera è obbligatoria",
      });
      expect(mockDb.$transaction).not.toHaveBeenCalled();
      expect(mockUtente.update).not.toHaveBeenCalled();
      expect(mockCollaboratore.create).not.toHaveBeenCalled();
      expect(mockCollaboratore.update).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("AC-2: riattiva un profilo disattivato quando il Collaboratore torna selezionato", async () => {
      mockUtente.findUnique.mockResolvedValue({
        ruolo: "COLLABORATORE",
        attivo: true,
        collaboratore: { attivo: false },
      });
      mockUtente.update.mockResolvedValue({ id: "utente-1" });
      const formData = new FormData();
      formData.set("id", "utente-1");
      formData.set("nome", "  Laura Verdi  ");
      formData.set("email", "  LAURA.VERDI@EXAMPLE.COM  ");
      formData.set("ruoloCollaboratore", "on");

      await aggiornaUtente(statoIniziale(), formData);

      expect(mockCollaboratore.create).not.toHaveBeenCalled();
      expect(mockCollaboratore.update).toHaveBeenCalledWith({
        where: { userId: "utente-1" },
        data: { attivo: true },
      });
      expect(mockCollaboratore.update).toHaveBeenCalledTimes(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/utenti");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        "/anagrafiche/collaboratori",
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        "/anagrafiche/utenti?esito=salvato",
      );
    });

    it("AC-3: disattiva il profilo quando il Collaboratore viene deselezionato, senza cancellarlo", async () => {
      mockUtente.findUnique.mockResolvedValue({
        ruolo: "COLLABORATORE",
        attivo: true,
        collaboratore: { attivo: true },
      });
      mockUtente.update.mockResolvedValue({ id: "utente-1" });

      await aggiornaUtente(statoIniziale(), formModificaUtente());

      expect(mockCollaboratore.update).toHaveBeenCalledWith({
        where: { userId: "utente-1" },
        data: { attivo: false },
      });
      expect(mockCollaboratore.update).toHaveBeenCalledTimes(1);
      expect(mockCollaboratore.create).not.toHaveBeenCalled();
      expect(mockCollaboratore.delete).not.toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/utenti");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        "/anagrafiche/collaboratori",
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        "/anagrafiche/utenti?esito=salvato",
      );
    });

    it("con profilo attivo e Collaboratore ancora selezionato non scrive sul collaboratore né rivalida i collaboratori", async () => {
      mockUtente.findUnique.mockResolvedValue({
        ruolo: "COLLABORATORE",
        attivo: true,
        collaboratore: { attivo: true },
      });
      mockUtente.update.mockResolvedValue({ id: "utente-1" });
      const formData = new FormData();
      formData.set("id", "utente-1");
      formData.set("nome", "  Laura Verdi  ");
      formData.set("email", "  LAURA.VERDI@EXAMPLE.COM  ");
      formData.set("ruoloCollaboratore", "on");

      await aggiornaUtente(statoIniziale(), formData);

      expect(mockUtente.update).toHaveBeenCalledWith({
        where: { id: "utente-1" },
        data: {
          nome: "Laura Verdi",
          email: "laura.verdi@example.com",
          ruolo: "COLLABORATORE",
        },
      });
      expect(mockCollaboratore.create).not.toHaveBeenCalled();
      expect(mockCollaboratore.update).not.toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledTimes(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/utenti");
      expect(mockRevalidatePath).not.toHaveBeenCalledWith(
        "/anagrafiche/collaboratori",
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        "/anagrafiche/utenti?esito=salvato",
      );
    });

    it("usa l'isolamento serializzabile e ritenta un conflitto P2034", async () => {
      mockDb.$transaction
        .mockRejectedValueOnce({ code: "P2034" })
        .mockImplementationOnce(
          async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
        );
      mockUtente.findUnique.mockResolvedValue({
        ruolo: "COLLABORATORE",
        attivo: true,
        collaboratore: null,
      });

      await aggiornaUtente(statoIniziale(), formModificaUtente());

      expect(mockDb.$transaction).toHaveBeenCalledTimes(2);
      expect(mockDb.$transaction).toHaveBeenNthCalledWith(
        1,
        expect.any(Function),
        { isolationLevel: "Serializable" },
      );
      expect(mockDb.$transaction).toHaveBeenNthCalledWith(
        2,
        expect.any(Function),
        { isolationLevel: "Serializable" },
      );
      expect(mockUtente.update).toHaveBeenCalledWith({
        where: { id: "utente-1" },
        data: {
          nome: "Laura Verdi",
          email: "laura.verdi@example.com",
          ruolo: "AMMINISTRATORE",
        },
      });
    });

    it("traduce il vincolo unique P2002 in errore email duplicata", async () => {
      mockUtente.findUnique.mockResolvedValue({
        ruolo: "COLLABORATORE",
        attivo: true,
        collaboratore: null,
      });
      mockUtente.update.mockRejectedValue({ code: "P2002" });

      const result = await aggiornaUtente(
        statoIniziale(),
        formModificaUtente(),
      );

      expect(result.errori).toEqual({
        email: "Esiste già un utente con questa email",
      });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("distingue il vincolo unico sul profilo collaboratore dal duplicato email", async () => {
      mockUtente.findUnique.mockResolvedValue({
        ruolo: "AMMINISTRATORE",
        attivo: true,
        collaboratore: null,
      });
      mockUtente.update.mockResolvedValue({ id: "utente-1" });
      mockCollaboratore.create.mockRejectedValue({
        code: "P2002",
        meta: { target: ["userId"] },
      });
      const formData = new FormData();
      formData.set("id", "utente-1");
      formData.set("nome", "  Mario  ");
      formData.set("email", "  MARIO.ROSSI@EXAMPLE.COM  ");
      formData.set("ruoloAmministratore", "on");
      formData.set("ruoloCollaboratore", "on");
      formData.set("cognome", "  Rossi  ");
      formData.set("partitaIva", "  12345678901  ");
      formData.set("tariffaGiornaliera", "  450,00  ");

      const result = await aggiornaUtente(statoIniziale(), formData);

      expect(result.errori).toEqual({
        _form: "Esiste già un profilo collaboratore per questo utente",
      });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });
});
