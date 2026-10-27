import { afterAll, describe, expect, it, vi } from "vitest";

// google-oauth legge le credenziali già all'import del modulo.
vi.hoisted(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id-di-test");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret-di-test");
});
import { urlAutorizzazione } from "@/lib/google-oauth";

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("urlAutorizzazione del login (US-004)", () => {
  it("forza la scelta dell'account senza cambiare scope, state e PKCE", async () => {
    const { url, state, codeVerifier } = await urlAutorizzazione();
    const parametri = new URL(url).searchParams;

    expect(parametri.get("prompt")).toBe("select_account");
    expect(parametri.get("scope")!.split(" ")).toEqual(["openid", "email", "profile"]);
    expect(parametri.get("state")).toBe(state);
    expect(parametri.get("code_challenge_method")).toBe("S256");
    expect(codeVerifier).toBeTruthy();
  });
});
