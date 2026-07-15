import { decodeJwt } from "jose";
import { expect, test, type Page } from "@playwright/test";
import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";

const BASE_URL = "http://localhost:3000";
const COOKIE_SESSIONE = "cp_sessione";

test.describe("US-029 Proxy e sessione sliding", () => {
  test("rotta protetta senza sessione → radice senza contenuto protetto", async ({
    page,
  }) => {
    await page.goto("/anagrafiche");

    await page.waitForURL((url) => url.pathname === "/");
    await expect(
      page.getByRole("heading", { name: "Coaching Planner" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Accedi con Google" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Clienti" })
    ).toHaveCount(0);
  });

  test("login crea il cookie e le richieste protette ne avanzano la scadenza", async ({
    page,
  }) => {
    await accediComeCollaboratore(page);

    const cookieIniziale = await leggiCookieSessione(page);
    expect(cookieIniziale).toBeDefined();

    const expiresIniziale = cookieIniziale!.expires;

    await expect
      .poll(
        async () => {
          await page.goto("/attivita");
          await page.waitForURL("**/attivita**");
          return (await leggiCookieSessione(page))?.expires ?? -1;
        },
        {
          timeout: 10_000,
          intervals: [0, 250, 500, 1_000, 1_000],
        }
      )
      .toBeGreaterThan(expiresIniziale);

    const cookieRinnovato = await leggiCookieSessione(page);
    expect(cookieRinnovato).toBeDefined();

    const claims = decodeJwt(cookieRinnovato!.value) as {
      exp: number;
      expiresAt: number;
    };

    expect(claims.exp).toBe(claims.expiresAt);
  });

  test("cookie manomesso su rotta protetta viene eliminato e reindirizzato", async ({
    page,
  }) => {
    await impostaCookieSessione(page, "token-manomesso");

    await page.goto("/anagrafiche");

    await page.waitForURL((url) => url.pathname === "/");
    await expect(
      page.getByRole("heading", { name: "Coaching Planner" })
    ).toBeVisible();
    await expect
      .poll(async () => Boolean(await leggiCookieSessione(page)))
      .toBe(false);
  });

  test("cookie manomesso su rotta pubblica viene eliminato senza bloccare l'accesso", async ({
    page,
  }) => {
    await impostaCookieSessione(page, "token-manomesso");

    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "Accedi con Google" })
    ).toBeVisible();
    await expect
      .poll(async () => Boolean(await leggiCookieSessione(page)))
      .toBe(false);
  });

  test("collaboratore su back office → /attivita", async ({ page }) => {
    await accediComeCollaboratore(page);

    await page.goto("/anagrafiche");

    await page.waitForURL("**/attivita**");
    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();
  });

  test("amministratore su front office → /anagrafiche", async ({ page }) => {
    await accediComeAdmin(page);

    await page.goto("/attivita");

    await page.waitForURL("**/anagrafiche**");
    await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();
  });

  test("logout elimina il cookie di sessione", async ({ page }) => {
    await accediComeAdmin(page);
    expect(await leggiCookieSessione(page)).toBeDefined();

    await page.locator("[data-esci]").click();

    await page.waitForURL(
      (url) => url.pathname === "/" && url.searchParams.get("logout") === "1"
    );
    await expect
      .poll(async () => Boolean(await leggiCookieSessione(page)))
      .toBe(false);
  });
});

async function leggiCookieSessione(page: Page) {
  return (await page.context().cookies()).find(
    (cookie) => cookie.name === COOKIE_SESSIONE
  );
}

async function impostaCookieSessione(page: Page, value: string) {
  await page.context().addCookies([
    {
      name: COOKIE_SESSIONE,
      value,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
