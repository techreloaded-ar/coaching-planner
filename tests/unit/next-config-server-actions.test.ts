import { afterEach, describe, expect, it, vi } from "vitest";
import { isCsrfOriginAllowed } from "next/dist/server/app-render/csrf-protection";

// Origini extra accettate per le Server Action: solo con Google simulato,
// per il proxy loopback della preview. Senza mock vale la sola stessa origine.

async function originiConsentite(modalitaE2e: string): Promise<string[] | undefined> {
  vi.resetModules();
  vi.stubEnv("SESSION_SECRET", "segreto-di-test-lungo-almeno-trentadue-caratteri");
  vi.stubEnv("E2E_TEST_MODE", modalitaE2e);
  const { default: config } = await import("../../next.config");
  return config.experimental?.serverActions?.allowedOrigins;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("next.config: origini delle Server Action", () => {
  it.each(["false", ""])("senza mock (E2E_TEST_MODE=%j) non accetta altre origini", async (valore) => {
    const origini = await originiConsentite(valore);

    expect(origini).toEqual([]);
    expect(isCsrfOriginAllowed("127.0.0.1:62471", origini)).toBe(false);
  });

  it("con i mock accetta il proxy loopback della preview su qualunque porta, non i domini esterni", async () => {
    const origini = await originiConsentite("true");

    expect(isCsrfOriginAllowed("127.0.0.1:62471", origini)).toBe(true);
    expect(isCsrfOriginAllowed("evil.example", origini)).toBe(false);
    expect(isCsrfOriginAllowed("127.0.0.1.evil.example", origini)).toBe(false);
  });
});
