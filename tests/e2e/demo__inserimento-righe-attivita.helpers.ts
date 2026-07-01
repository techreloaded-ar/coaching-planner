import { expect, type Page } from "@playwright/test";

export async function loginComeGiulia(page: Page) {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Accedi" })
  ).toBeVisible();

  await page.evaluate(async () => {
    const res = await fetch("/api/e2e-test/sessione", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "giulia.conti@agilereloaded.it" }),
    });
    const data = await res.json();
    if (data.redirect) {
      window.location.href = data.redirect;
    }
  });

  await page.waitForURL("**/attivita**");
}

export function dataOggiOffset(giorno: number): string {
  const oggi = new Date();
  const a = oggi.getFullYear();
  const m = String(oggi.getMonth() + 1).padStart(2, "0");
  const g = String(giorno).padStart(2, "0");
  return `${a}-${m}-${g}`;
}

export function dataMesePrecedenteGiorno(giorno: number): string {
  const data = new Date();
  data.setMonth(data.getMonth() - 1, giorno);

  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const g = String(data.getDate()).padStart(2, "0");
  return `${a}-${m}-${g}`;
}
