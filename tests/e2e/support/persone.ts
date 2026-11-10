import { expect, type Page } from "@playwright/test";

export async function apriPersone(page: Page) {
  await page.goto("/anagrafiche/persone");
  await expect(
    page.getByRole("region", { name: "Persone", exact: true }),
  ).toHaveAttribute("data-idratata", "true");
}

export function rigaPersona(page: Page, email: string) {
  return page
    .getByRole("table", { name: "Elenco persone", exact: true })
    .getByRole("row")
    .filter({ has: page.getByText(email, { exact: true }) });
}

export async function apriPersona(
  page: Page,
  id: string,
  sezione = "anagrafica",
) {
  await page.goto(`/anagrafiche/persone/${id}?sezione=${sezione}`);
  await attendiSchedaPersona(page);
}

export async function attendiSchedaPersona(page: Page) {
  await expect(
    page
      .getByLabel("Scheda persona", { exact: true })
      .filter({ has: page.getByRole("heading", { level: 1 }) }),
  ).toHaveAttribute("data-idratata", "true");
}

export async function salvaPersona(page: Page) {
  // Due salvataggi nella stessa sezione hanno lo stesso URL e lo stesso
  // messaggio: attendiamo la risposta della nuova action e il ritorno del
  // pulsante allo stato utilizzabile, non il messaggio precedente.
  const percorso = new URL(page.url()).pathname;
  const salvataggio = page.waitForResponse(
    (risposta) =>
      risposta.request().method() === "POST" &&
      new URL(risposta.url()).pathname === percorso,
  );
  await page
    .getByRole("button", { name: "Salva modifiche", exact: true })
    .click();
  await salvataggio;
  await expect(page.getByRole("button", { name: "Salva modifiche", exact: true, includeHidden: true })).toBeEnabled();
  await page.waitForURL(
    (url) =>
      url.pathname.startsWith("/anagrafiche/persone/") &&
      url.searchParams.get("esito") === "salvato",
  );
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Modifiche alla persona salvate" }),
  ).toBeVisible();
}
