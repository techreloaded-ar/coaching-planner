import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy, config } from "@/proxy";
import {
  DURATA_SESSIONE_SECONDI,
  NOME_COOKIE_SESSIONE,
} from "@/lib/session-config";
import { creaTokenSessione } from "@/lib/session-token";

const BASE_URL = "https://coaching-planner.test";
const SESSION_SECRET_VALIDA =
  "chiave-di-test-lunga-almeno-32-caratteri-!!";

let sessionSecretOriginale = process.env.SESSION_SECRET;

describe("proxy", () => {
  beforeEach(() => {
    sessionSecretOriginale = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = SESSION_SECRET_VALIDA;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();

    if (sessionSecretOriginale === undefined) {
      delete process.env.SESSION_SECRET;
      return;
    }

    process.env.SESSION_SECRET = sessionSecretOriginale;
  });

  it("lascia passare la radice pubblica senza cookie", async () => {
    const response = await proxy(creaRequest("/"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("lascia passare /login senza redirect", async () => {
    const response = await proxy(creaRequest("/login"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("reindirizza una rotta protetta senza cookie verso la radice", async () => {
    const response = await proxy(creaRequest("/anagrafiche"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${BASE_URL}/`);
  });

  it("con cookie valido sulla radice rinnova la sessione ma non sceglie il ruolo", async () => {
    const now = 1_700_000_000;
    vi.setSystemTime(new Date(now * 1000));
    const sessione = await creaTokenSessione(
      {
        utenteId: "admin-1",
        ruolo: "AMMINISTRATORE",
        nome: "Admin",
        email: "admin@example.com",
      },
      { now: now - 300 }
    );

    const response = await proxy(creaRequest("/", sessione.token));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain(NOME_COOKIE_SESSIONE);
    expect(response.headers.get("set-cookie")).toContain(
      `Expires=${new Date((now + DURATA_SESSIONE_SECONDI) * 1000).toUTCString()}`
    );
  });

  it("pulisce un cookie invalido su rotta pubblica senza reindirizzare", async () => {
    const response = await proxy(creaRequest("/", "token-invalido"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain(`${NOME_COOKIE_SESSIONE}=;`);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("pulisce un cookie invalido e reindirizza su rotta protetta", async () => {
    const response = await proxy(creaRequest("/anagrafiche", "token-invalido"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${BASE_URL}/`);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it.each([
    ["AMMINISTRATORE", "admin-1", "Admin", "admin@example.com"],
    ["COLLABORATORE", "collab-1", "Collab", "collab@example.com"],
  ] as const)(
    "lascia passare %s sulla rotta AUTENTICATO rinnovando il cookie",
    async (ruolo, utenteId, nome, email) => {
      const now = 1_700_000_000;
      vi.setSystemTime(new Date(now * 1000));
      const sessione = await creaTokenSessione(
        { utenteId, ruolo, nome, email },
        { now: now - 60 }
      );

      const response = await proxy(creaRequest("/attivita", sessione.token));

      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("set-cookie")).toContain(NOME_COOKIE_SESSIONE);
    }
  );

  it("lascia passare il collaboratore sulla rotta AMMINISTRATORE rinnovando il cookie", async () => {
    const now = 1_700_000_000;
    vi.setSystemTime(new Date(now * 1000));
    const sessione = await creaTokenSessione(
      {
        utenteId: "collab-1",
        ruolo: "COLLABORATORE",
        nome: "Collab",
        email: "collab@example.com",
      },
      { now: now - 60 }
    );

    const response = await proxy(creaRequest("/anagrafiche", sessione.token));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain(NOME_COOKIE_SESSIONE);
  });

  it("lascia passare una rotta protetta consentita rinnovando il cookie", async () => {
    const now = 1_700_000_000;
    vi.setSystemTime(new Date(now * 1000));
    const sessione = await creaTokenSessione(
      {
        utenteId: "admin-2",
        ruolo: "AMMINISTRATORE",
        nome: "Admin",
        email: "admin2@example.com",
      },
      { now: now - 60 }
    );

    const response = await proxy(creaRequest("/anagrafiche", sessione.token));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain(NOME_COOKIE_SESSIONE);
  });

  it("non rinnova il cookie sulle API pubbliche che creano sessione", async () => {
    const now = 1_700_000_000;
    vi.setSystemTime(new Date(now * 1000));
    const sessione = await creaTokenSessione(
      {
        utenteId: "admin-3",
        ruolo: "AMMINISTRATORE",
        nome: "Admin",
        email: "admin3@example.com",
      },
      { now: now - 60 }
    );

    const response = await proxy(
      creaRequest("/api/e2e-test/sessione", sessione.token)
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("espone un matcher statico che esclude asset Next e immagini pubbliche", () => {
    expect(config.matcher).toEqual([
      "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ]);
  });
});

function creaRequest(pathname: string, token?: string) {
  const headers = token
    ? { cookie: `${NOME_COOKIE_SESSIONE}=${token}` }
    : undefined;

  return new NextRequest(`${BASE_URL}${pathname}`, { headers });
}
