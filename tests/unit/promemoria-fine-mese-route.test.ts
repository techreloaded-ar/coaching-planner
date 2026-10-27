import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * US-019 — Confine di fiducia della route cron e dell'invio manuale.
 */

const { mockInviaPromemoriaFineMese } = vi.hoisted(() => ({
  mockInviaPromemoriaFineMese: vi.fn(),
}));

vi.mock("@/lib/promemoria-fine-mese", () => ({
  inviaPromemoriaFineMese: mockInviaPromemoriaFineMese,
}));

const { mockRichiediRuoloApi, mockRedirect } = vi.hoisted(() => ({
  mockRichiediRuoloApi: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/dal", () => ({ richiediRuoloApi: mockRichiediRuoloApi }));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/promemoria-fine-mese/route";
import { inviaPromemoriaFineMeseOra } from "@/app/(back-office)/report/fatturazione-clienti/actions";

const ESITO = { inviati: 2, giaInviati: 1, falliti: 0 };

function richiesta(authorization?: string): NextRequest {
  return new NextRequest("https://coaching-planner.test/api/cron/promemoria-fine-mese", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe("GET /api/cron/promemoria-fine-mese (US-019)", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    mockInviaPromemoriaFineMese.mockReset().mockResolvedValue(ESITO);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rifiuta la chiamata senza header Authorization", async () => {
    const response = await GET(richiesta());
    expect(response.status).toBe(401);
    expect(mockInviaPromemoriaFineMese).not.toHaveBeenCalled();
  });

  it("rifiuta un secret errato", async () => {
    const response = await GET(richiesta("Bearer altro"));
    expect(response.status).toBe(401);
    expect(mockInviaPromemoriaFineMese).not.toHaveBeenCalled();
  });

  it("rifiuta tutto se CRON_SECRET non è configurato", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(richiesta("Bearer "));
    expect(response.status).toBe(401);
    expect(mockInviaPromemoriaFineMese).not.toHaveBeenCalled();
  });

  it("con il secret corretto avvia l'invio automatico e ne restituisce l'esito (AC-1)", async () => {
    const response = await GET(richiesta("Bearer s3cr3t"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(ESITO);
    expect(mockInviaPromemoriaFineMese).toHaveBeenCalledWith({ modalita: "AUTOMATICA" });
  });
});

describe("inviaPromemoriaFineMeseOra (US-019)", () => {
  beforeEach(() => {
    mockRichiediRuoloApi.mockReset().mockResolvedValue(undefined);
    mockRedirect.mockReset();
    mockInviaPromemoriaFineMese.mockReset().mockResolvedValue({ inviati: 3, giaInviati: 0, falliti: 1 });
  });

  it("senza ruolo amministratore non invia nulla", async () => {
    mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));
    await expect(inviaPromemoriaFineMeseOra()).rejects.toThrow("Accesso negato");
    expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
    expect(mockInviaPromemoriaFineMese).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("invia subito in modalità manuale e riporta i conteggi nel report (AC-6)", async () => {
    await inviaPromemoriaFineMeseOra();
    expect(mockInviaPromemoriaFineMese).toHaveBeenCalledWith({ modalita: "MANUALE" });
    expect(mockRedirect).toHaveBeenCalledWith(
      "/report/fatturazione-clienti?promemoriaInviati=3&promemoriaFalliti=1"
    );
  });
});
