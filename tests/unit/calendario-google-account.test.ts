import { afterAll, describe, expect, it, vi } from "vitest";

// google-oauth legge le credenziali già all'import del modulo.
vi.hoisted(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id-di-test");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret-di-test");
});
import { stessoAccountGoogle } from "@/domain/calendario-google";
import {
  REFRESH_TOKEN_E2E_SENZA_EVENTI,
  scambiaCodiceCalendario,
  urlConsensoCalendario,
} from "@/lib/calendario-google";

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("stessoAccountGoogle (US-003)", () => {
  it("confronta le email senza distinzione tra maiuscole e minuscole", () => {
    expect(stessoAccountGoogle("Mario.Rossi@Esempio.IT", "mario.rossi@esempio.it")).toBe(true);
    expect(stessoAccountGoogle(" mario.rossi@esempio.it", "mario.rossi@esempio.it ")).toBe(true);
  });

  it("distingue account diversi", () => {
    expect(stessoAccountGoogle("mario.rossi@gmail.com", "mario.rossi@esempio.it")).toBe(false);
    expect(stessoAccountGoogle("", "mario.rossi@esempio.it")).toBe(false);
  });
});

describe("urlConsensoCalendario (US-003 AC-1)", () => {
  it("forza la scelta dell'account, mantiene il token di rinnovo e suggerisce l'email di accesso", () => {
    vi.stubEnv("E2E_TEST_MODE", "false");

    const url = new URL(urlConsensoCalendario("state", "verifier", "collab@esempio.it"));

    expect(url.searchParams.get("prompt")!.split(" ").sort()).toEqual(["consent", "select_account"]);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("login_hint")).toBe("collab@esempio.it");
    expect(url.searchParams.get("scope")!.split(" ")).toEqual(
      expect.arrayContaining(["openid", "email", "https://www.googleapis.com/auth/calendar.readonly"])
    );
  });
});

describe("consenso simulato in E2E_TEST_MODE (US-003 AC-6)", () => {
  it("autorizza l'account di accesso e riporta l'email del codice di test", async () => {
    vi.stubEnv("E2E_TEST_MODE", "true");

    const code = new URL(urlConsensoCalendario("state", "verifier", "collab@esempio.it"))
      .searchParams.get("code")!;

    expect(await scambiaCodiceCalendario(code, "verifier")).toEqual({
      refreshToken: REFRESH_TOKEN_E2E_SENZA_EVENTI,
      emailAutorizzata: "collab@esempio.it",
    });
    expect(await scambiaCodiceCalendario("e2e-consenso:altro@esempio.it", "verifier")).toEqual({
      refreshToken: REFRESH_TOKEN_E2E_SENZA_EVENTI,
      emailAutorizzata: "altro@esempio.it",
    });
    expect(await scambiaCodiceCalendario("codice-sconosciuto", "verifier")).toBeNull();
  });
});
