import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateTransport, mockSendMail } = vi.hoisted(() => ({
  mockCreateTransport: vi.fn(),
  mockSendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

const mockDb = vi.hoisted(() => ({
  collaboratore: { findMany: vi.fn() },
  promemoriaFineMeseInviato: { create: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

const { mockInviaEmail } = vi.hoisted(() => ({ mockInviaEmail: vi.fn() }));

// Mock usato solo dall'orchestrazione; i test di inviaEmail importano il modulo reale.
vi.mock("@/lib/email", () => ({ inviaEmail: mockInviaEmail }));

import { inviaPromemoriaFineMese } from "@/lib/promemoria-fine-mese";

const { inviaEmail } = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");

const PASSWORD_SMTP = "password-smtp-segreta";

const EMAIL = {
  destinatario: "giulia@example.it",
  oggetto: "Promemoria di fine mese",
  testo: "Ciao Giulia",
};

describe("inviaEmail (US-019)", () => {
  beforeEach(() => {
    vi.stubEnv("E2E_TEST_MODE", "false");
    vi.stubEnv("SMTP_HOST", "mail.example.it");
    vi.stubEnv("SMTP_PORT", "465");
    vi.stubEnv("SMTP_USER", "noreply@example.it");
    vi.stubEnv("SMTP_PASSWORD", PASSWORD_SMTP);
    vi.stubEnv("EMAIL_MITTENTE", "Coaching Planner <noreply@example.it>");
    vi.stubEnv("EMAIL_DESTINATARIO_DI_PROVA", "");
    mockCreateTransport.mockReset().mockReturnValue({ sendMail: mockSendMail });
    mockSendMail.mockReset().mockResolvedValue({});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("invia con SSL sulla porta 465, con autenticazione e mittente configurati (AC-2)", async () => {
    expect(await inviaEmail(EMAIL)).toBe(true);
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: "mail.example.it",
      port: 465,
      secure: true,
      auth: { user: "noreply@example.it", pass: PASSWORD_SMTP },
    });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: "Coaching Planner <noreply@example.it>",
      to: "giulia@example.it",
      subject: "Promemoria di fine mese",
      text: "Ciao Giulia",
    });
  });

  it("non usa SSL implicito sulla porta 587", async () => {
    vi.stubEnv("SMTP_PORT", "587");
    await inviaEmail(EMAIL);
    expect(mockCreateTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587, secure: false }));
  });

  it("non invia senza SMTP_HOST", async () => {
    vi.stubEnv("SMTP_HOST", "");
    expect(await inviaEmail(EMAIL)).toBe(false);
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it("considera assente una porta non numerica", async () => {
    vi.stubEnv("SMTP_PORT", "abc");
    expect(await inviaEmail(EMAIL)).toBe(false);
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it("restituisce false se l'SMTP rifiuta, senza scrivere la password nei log", async () => {
    const errore = Object.assign(new Error(`Invalid login for ${PASSWORD_SMTP}`), { code: "EAUTH" });
    mockSendMail.mockRejectedValue(errore);
    expect(await inviaEmail(EMAIL)).toBe(false);
    const log = vi.mocked(console.error).mock.calls.flat().map(String).join(" ");
    expect(log).toContain("EAUTH");
    expect(log).not.toContain(PASSWORD_SMTP);
  });

  it("in E2E_TEST_MODE non contatta l'SMTP", async () => {
    vi.stubEnv("E2E_TEST_MODE", "true");
    expect(await inviaEmail(EMAIL)).toBe(true);
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it("con EMAIL_DESTINATARIO_DI_PROVA dirotta l'email e riporta il destinatario originale", async () => {
    vi.stubEnv("EMAIL_DESTINATARIO_DI_PROVA", "prova@x.it");
    await inviaEmail(EMAIL);
    const opzioni = mockSendMail.mock.calls[0][0];
    expect(opzioni.to).toBe("prova@x.it");
    expect(opzioni.subject).toContain("giulia@example.it");
    expect(opzioni.subject).toContain("Promemoria di fine mese");
  });
});

describe("inviaPromemoriaFineMese (US-019)", () => {
  const ULTIMO_GIORNO_LAVORATIVO = new Date("2026-10-30T07:00:00Z");

  const COLLABORATORI = [
    { id: "col-giulia", nome: "Giulia", utente: { email: "giulia@example.it" } },
    { id: "col-marco", nome: "Marco", utente: { email: "marco@example.it" } },
  ];

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://cp.example");
    mockDb.collaboratore.findMany.mockReset().mockResolvedValue(COLLABORATORI);
    mockDb.promemoriaFineMeseInviato.create.mockReset().mockResolvedValue({});
    mockDb.promemoriaFineMeseInviato.delete.mockReset().mockResolvedValue({});
    mockInviaEmail.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("in automatico non fa nulla se oggi non è l'ultimo giorno lavorativo (AC-1)", async () => {
    const esito = await inviaPromemoriaFineMese({
      modalita: "AUTOMATICA",
      adesso: new Date("2026-10-31T07:00:00Z"),
    });
    expect(esito).toEqual({ inviati: 0, giaInviati: 0, falliti: 0 });
    expect(mockDb.collaboratore.findMany).not.toHaveBeenCalled();
    expect(mockInviaEmail).not.toHaveBeenCalled();
  });

  it("l'ultimo giorno lavorativo scrive a ogni collaboratore attivo al proprio indirizzo (AC-1, AC-3, AC-4)", async () => {
    const esito = await inviaPromemoriaFineMese({ modalita: "AUTOMATICA", adesso: ULTIMO_GIORNO_LAVORATIVO });

    expect(mockDb.collaboratore.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { attivo: true, utente: { attivo: true } } })
    );
    expect(mockDb.promemoriaFineMeseInviato.create).toHaveBeenCalledWith({
      data: { collaboratoreId: "col-giulia", mese: "2026-10" },
    });
    expect(mockInviaEmail).toHaveBeenCalledTimes(2);
    expect(mockInviaEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        destinatario: "giulia@example.it",
        testo: expect.stringContaining("https://cp.example/attivita"),
      })
    );
    expect(mockInviaEmail).toHaveBeenCalledWith(expect.objectContaining({ destinatario: "marco@example.it" }));
    expect(esito).toEqual({ inviati: 2, giaInviati: 0, falliti: 0 });
  });

  it("salta chi ha già ricevuto il promemoria del mese (AC-5)", async () => {
    mockDb.promemoriaFineMeseInviato.create.mockRejectedValueOnce({ code: "P2002" });
    const esito = await inviaPromemoriaFineMese({ modalita: "AUTOMATICA", adesso: ULTIMO_GIORNO_LAVORATIVO });
    expect(mockInviaEmail).toHaveBeenCalledTimes(1);
    expect(mockInviaEmail).toHaveBeenCalledWith(expect.objectContaining({ destinatario: "marco@example.it" }));
    expect(esito).toEqual({ inviati: 1, giaInviati: 1, falliti: 0 });
  });

  it("cancella la prenotazione se l'invio non riesce, così il cron ritenta (AC-5)", async () => {
    mockInviaEmail.mockResolvedValueOnce(false);
    const esito = await inviaPromemoriaFineMese({ modalita: "AUTOMATICA", adesso: ULTIMO_GIORNO_LAVORATIVO });
    expect(mockDb.promemoriaFineMeseInviato.delete).toHaveBeenCalledWith({
      where: { collaboratoreId_mese: { collaboratoreId: "col-giulia", mese: "2026-10" } },
    });
    expect(esito).toEqual({ inviati: 1, giaInviati: 0, falliti: 1 });
  });

  it("rilancia gli errori del database diversi dal doppione", async () => {
    mockDb.promemoriaFineMeseInviato.create.mockRejectedValueOnce(new Error("connessione persa"));
    await expect(
      inviaPromemoriaFineMese({ modalita: "AUTOMATICA", adesso: ULTIMO_GIORNO_LAVORATIVO })
    ).rejects.toThrow("connessione persa");
    expect(mockInviaEmail).not.toHaveBeenCalled();
  });

  it("in manuale invia subito a tutti senza usare il registro (AC-6)", async () => {
    mockInviaEmail.mockResolvedValueOnce(false);
    const esito = await inviaPromemoriaFineMese({
      modalita: "MANUALE",
      adesso: new Date("2026-10-15T07:00:00Z"),
    });
    expect(mockInviaEmail).toHaveBeenCalledTimes(2);
    expect(mockDb.promemoriaFineMeseInviato.create).not.toHaveBeenCalled();
    expect(mockDb.promemoriaFineMeseInviato.delete).not.toHaveBeenCalled();
    expect(esito).toEqual({ inviati: 1, giaInviati: 0, falliti: 1 });
  });
});
