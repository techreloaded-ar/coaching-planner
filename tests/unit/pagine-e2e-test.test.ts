import { afterEach, describe, expect, it, vi } from "vitest";

// Le pagine di login e consenso simulati esistono solo con E2E_TEST_MODE=true:
// senza mock rispondono 404 senza leggere il database.

const { mockFindMany } = vi.hoisted(() => {
  // google-oauth legge le credenziali già all'import del modulo.
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id-di-test");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret-di-test");
  return { mockFindMany: vi.fn() };
});

vi.mock("@/lib/db", () => ({ db: { utente: { findMany: mockFindMany } } }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: vi.fn(),
}));

import ScegliUtentePage from "@/app/e2e-test/scegli-utente/page";
import ConsensoCalendarioPage from "@/app/e2e-test/consenso-calendario/page";

const NON_TROVATA = expect.objectContaining({
  digest: expect.stringContaining("404"),
});

afterEach(() => {
  vi.clearAllMocks();
});

describe.each(["false", ""])("senza mock (E2E_TEST_MODE=%j)", (valore) => {
  it("la scelta dell'utente risponde 404 e non elenca utenti", async () => {
    vi.stubEnv("E2E_TEST_MODE", valore);

    await expect(ScegliUtentePage()).rejects.toEqual(NON_TROVATA);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("il consenso calendario simulato risponde 404", async () => {
    vi.stubEnv("E2E_TEST_MODE", valore);

    await expect(
      ConsensoCalendarioPage({
        searchParams: Promise.resolve({ state: "s", login_hint: "collab@esempio.it" }),
      })
    ).rejects.toEqual(NON_TROVATA);
  });
});

describe("con mock (E2E_TEST_MODE=true)", () => {
  it("elenca solo gli utenti che il login reale accetterebbe", async () => {
    vi.stubEnv("E2E_TEST_MODE", "true");
    mockFindMany.mockResolvedValue([]);

    await ScegliUtentePage();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          attivo: true,
          NOT: { ruolo: "COLLABORATORE", collaboratore: { is: { attivo: false } } },
        },
      })
    );
  });
});
