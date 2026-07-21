import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUtente = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { utente: mockUtente },
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
  formData.set("ruolo", "AMMINISTRATORE");
  return formData;
}

function formModificaUtente(): FormData {
  const formData = new FormData();
  formData.set("id", "utente-1");
  formData.set("nome", "  Laura Verdi  ");
  formData.set("email", "  LAURA.VERDI@EXAMPLE.COM  ");
  formData.set("ruolo", "AMMINISTRATORE");
  return formData;
}

describe("Server Actions utenti", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
  });

  describe("creaUtente", () => {
    it("invoca la guardia amministratore e ne propaga gli errori senza accedere al database", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(
        creaUtente(statoIniziale(), formNuovoUtente())
      ).rejects.toThrow("Accesso negato");

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockUtente.findUnique).not.toHaveBeenCalled();
      expect(mockUtente.create).not.toHaveBeenCalled();
    });

    it("usa la validazione reale e con dati non validi non crea utenti", async () => {
      const formData = new FormData();
      formData.set("nome", "  ");
      formData.set("email", "senza-chiocciola");
      formData.set("ruolo", "SUPERVISORE");

      const result = await creaUtente(statoIniziale(), formData);

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(result.errori).toEqual({
        nome: "Il nome è obbligatorio",
        email: "Inserisci un indirizzo email valido",
        ruolo: "Seleziona un ruolo valido",
      });
      expect(mockUtente.findUnique).not.toHaveBeenCalled();
      expect(mockUtente.create).not.toHaveBeenCalled();
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
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("crea un utente con dati normalizzati e ruolo scelto, poi aggiorna la pagina e redirige", async () => {
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
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/utenti");
      expect(mockRedirect).toHaveBeenCalledWith(
        "/anagrafiche/utenti?esito=creato"
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
        aggiornaUtente(statoIniziale(), formModificaUtente())
      ).rejects.toThrow("Accesso negato");

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockUtente.findUnique).not.toHaveBeenCalled();
      expect(mockUtente.update).not.toHaveBeenCalled();
    });

    it("rifiuta un form senza id", async () => {
      const formData = formModificaUtente();
      formData.delete("id");

      const result = await aggiornaUtente(statoIniziale(), formData);

      expect(result.errori).toEqual({ _form: "ID utente mancante" });
      expect(mockUtente.findUnique).not.toHaveBeenCalled();
      expect(mockUtente.update).not.toHaveBeenCalled();
    });

    it("restituisce un errore quando l'utente non esiste", async () => {
      mockUtente.findUnique.mockResolvedValue(null);

      const result = await aggiornaUtente(
        statoIniziale(),
        formModificaUtente()
      );

      expect(mockUtente.findUnique).toHaveBeenCalledWith({
        where: { id: "utente-1" },
        select: { ruolo: true },
      });
      expect(result.errori).toEqual({ _form: "Utente non trovato" });
      expect(mockUtente.update).not.toHaveBeenCalled();
    });

    it("aggiorna esattamente nome ed email normalizzati senza ruolo né stato, poi redirige", async () => {
      mockUtente.findUnique.mockResolvedValue({ ruolo: "COLLABORATORE" });
      mockUtente.update.mockResolvedValue({ id: "utente-1" });

      await aggiornaUtente(statoIniziale(), formModificaUtente());

      expect(mockUtente.update).toHaveBeenCalledWith({
        where: { id: "utente-1" },
        data: {
          nome: "Laura Verdi",
          email: "laura.verdi@example.com",
        },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/utenti");
      expect(mockRedirect).toHaveBeenCalledWith(
        "/anagrafiche/utenti?esito=salvato"
      );
    });

    it("usa il ruolo persistito per la validazione reale e non quello inviato dal form", async () => {
      mockUtente.findUnique.mockResolvedValue({ ruolo: "COLLABORATORE" });
      const formData = formModificaUtente();
      formData.set("ruolo", "SUPERVISORE");

      await aggiornaUtente(statoIniziale(), formData);

      expect(mockUtente.update).toHaveBeenCalledWith({
        where: { id: "utente-1" },
        data: {
          nome: "Laura Verdi",
          email: "laura.verdi@example.com",
        },
      });
    });

    it("traduce il vincolo unique P2002 in errore email duplicata", async () => {
      mockUtente.findUnique.mockResolvedValue({ ruolo: "COLLABORATORE" });
      mockUtente.update.mockRejectedValue({ code: "P2002" });

      const result = await aggiornaUtente(
        statoIniziale(),
        formModificaUtente()
      );

      expect(result.errori).toEqual({
        email: "Esiste già un utente con questa email",
      });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });
});
