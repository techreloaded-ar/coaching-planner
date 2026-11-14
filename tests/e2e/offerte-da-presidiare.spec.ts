import { randomUUID } from "node:crypto";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { cercaNellElenco, selezionaRighe } from "./support/elenchi";
import { test, expect } from "./support/fixtures";
import { apriPaginaOfferte, attendiTabellaOfferteIdratata } from "./support/offerte";

test.beforeEach(async ({ page }) => {
	await accediAlBackOfficeComeAdmin(page);
});

test("l'avviso filtra tutte le pagine e conserva ricerca, ricarica e ritorno all'elenco completo", async ({
	page, factory, collaboratore,
}) => {
	const token = randomUUID().slice(0, 8).toUpperCase();
	const cliente = await factory.createCliente({ ragioneSociale: `Presidio ${token}` });
	const codice = (indice: number) => `PRES-${token}-${String(indice).padStart(2, "0")}`;
	for (let indice = 1; indice <= 27; indice++) {
		const offerta = await factory.createOfferta({ cliente, codice: codice(indice), giorniPrevisti: 1 });
		await factory.createRigaAttivita({
			cliente, offerta, collaboratore, ore: indice % 2 === 0 ? "9.00" : "8.00",
		});
	}
	const regolare = await factory.createOfferta({ cliente, codice: `REG-${token}` });
	const disattivata = await factory.createOfferta({ cliente, attiva: false, giorniPrevisti: 1 });
	await factory.createRigaAttivita({ cliente, offerta: disattivata, collaboratore, ore: "16.00" });
	await factory.createOfferta({ cliente, giorniPrevisti: null });
	const tabella = page.getByRole("table", { name: "Elenco offerte" });
	const dettagli = tabella.getByRole("button", { name: /^Dettaglio avanzamento / });
	const navigazione = page.getByRole("navigation", { name: "Paginazione" });
	const avviso = page.getByRole("link", { name: "27 da presidiare", exact: true });
	const filtroAttivo = page.getByText("Solo offerte da presidiare", { exact: true });
	const urlFiltrata = (url: URL, pagina: string | null = null) =>
		url.pathname === "/offerte" && url.searchParams.get("daPresidiare") === "1" &&
		url.searchParams.get("q") === cliente.ragioneSociale && url.searchParams.get("pagina") === pagina;

	await apriPaginaOfferte(page, cliente.ragioneSociale);
	await navigazione.getByRole("link", { name: "Successiva", exact: true }).click();
	await expect(dettagli).toHaveCount(5);
	// L'avviso è attivabile da tastiera e riparte da pagina 1.
	await avviso.focus();
	await avviso.press("Enter");
	await page.waitForURL((url) => urlFiltrata(url));
	await expect(filtroAttivo).toBeVisible();
	await expect(avviso).toHaveAttribute("aria-current", "true");
	await expect(dettagli).toHaveCount(25);
	await expect(page.getByText("27 offerte · 27 attive · 0 disattivate", { exact: true })).toBeVisible();
	await expect(page.getByText("Mostrati 1–25 di 27", { exact: true })).toBeVisible();
	await page.screenshot({ path: test.info().outputPath("offerte-da-presidiare.png"), fullPage: true, animations: "disabled" });

	await navigazione.getByRole("link", { name: "Successiva", exact: true }).click();
	await page.waitForURL((url) => urlFiltrata(url, "2"));
	await expect(dettagli).toHaveCount(2);
	await expect(tabella.getByText(codice(26), { exact: true })).toBeVisible();
	await expect(tabella.getByText(codice(27), { exact: true })).toBeVisible();
	await page.reload();
	await attendiTabellaOfferteIdratata(page);
	await expect(filtroAttivo).toBeVisible();
	await expect(dettagli).toHaveCount(2);

	// La ricerca continua a intersecare il filtro, anche senza risultati.
	await cercaNellElenco(page, "/offerte", regolare.codice);
	await expect(page).toHaveURL((url) => url.searchParams.get("daPresidiare") === "1" && !url.searchParams.has("pagina"));
	await expect(page.getByText("Nessuna offerta da presidiare corrisponde alla ricerca.", { exact: true })).toBeVisible();
	await expect(page.getByRole("link", { name: /\d+ da presidiare/ })).toHaveCount(0);
	await page.getByRole("link", { name: "Mostra tutte le offerte", exact: true }).click();
	await page.waitForURL((url) => !url.searchParams.has("daPresidiare") && url.searchParams.get("q") === regolare.codice);
	await expect(dettagli).toHaveCount(1);
	await expect(tabella.getByText(regolare.codice, { exact: true })).toBeVisible();

	// Rimozione del filtro dalla seconda pagina: torna alla prima mantenendo q.
	await apriPaginaOfferte(page, cliente.ragioneSociale);
	await avviso.click();
	await page.waitForURL((url) => urlFiltrata(url));
	await navigazione.getByRole("link", { name: "Successiva", exact: true }).click();
	await page.waitForURL((url) => urlFiltrata(url, "2"));
	await page.getByRole("link", { name: "Mostra tutte le offerte", exact: true }).click();
	await page.waitForURL((url) =>
		!url.searchParams.has("daPresidiare") && !url.searchParams.has("pagina") && url.searchParams.get("q") === cliente.ragioneSociale,
	);
	await expect(dettagli).toHaveCount(25);
	await expect(page.getByText("30 offerte · 29 attive · 1 disattivate", { exact: true })).toBeVisible();
	await expect(filtroAttivo).toHaveCount(0);
	await page.goBack();
	await page.waitForURL((url) => urlFiltrata(url, "2"));
	await expect(filtroAttivo).toBeVisible();
	await expect(dettagli).toHaveCount(2);
	// Anche la disattivazione dalla barra azioni torna alla pagina filtrata.
	await attendiTabellaOfferteIdratata(page);
	const barra = await selezionaRighe(page, [codice(27)]);
	await barra.getByRole("button", { name: "Disattiva", exact: true }).click();
	await page.getByRole("dialog", { name: `Disattivare «${codice(27)}»?` })
		.getByRole("button", { name: "Disattiva", exact: true }).click();
	await page.waitForURL((url) => urlFiltrata(url, "2") && url.searchParams.get("esito") === "stato-offerta-aggiornato");
	await expect(dettagli).toHaveCount(1);
	await expect(page.getByText("26 offerte · 26 attive · 0 disattivate", { exact: true })).toBeVisible();
});

test("modifica, collaboratori e disattivazione conservano il filtro fino all'ultima offerta", async ({
	page, factory, collaboratore,
}) => {
	const { cliente, offerta } = await factory.createClienteConOfferta({}, {
		giorniPrevisti: 1,
		codice: `PRES-MOD-${randomUUID().slice(0, 8).toUpperCase()}`,
	});
	await factory.createRigaAttivita({ cliente, offerta, collaboratore, ore: "8.00" });
	await apriPaginaOfferte(page, cliente.ragioneSociale);
	await page.getByRole("link", { name: "1 da presidiare", exact: true }).click();
	await page.waitForURL((url) => url.searchParams.get("daPresidiare") === "1");

	let barra = await selezionaRighe(page, [offerta.codice]);
	await barra.getByRole("link", { name: "Modifica", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Modifica offerta", exact: true })).toBeVisible();
	await expect(page.getByRole("link", { name: "Torna alle offerte", exact: true })).toHaveAttribute("href", /daPresidiare=1/);
	await page.getByRole("textbox", { name: "Descrizione", exact: true }).fill("Presidio verificato");
	await page.getByRole("button", { name: "Salva offerta", exact: true }).click();
	await page.waitForURL((url) => url.pathname === "/offerte" && url.searchParams.get("esito") === "offerta-salvata");
	await expect(page).toHaveURL((url) => url.searchParams.get("daPresidiare") === "1" && url.searchParams.get("q") === cliente.ragioneSociale);
	await attendiTabellaOfferteIdratata(page);
	await expect(page.getByText("Presidio verificato", { exact: true })).toBeVisible();

	barra = await selezionaRighe(page, [offerta.codice]);
	await barra.getByRole("link", { name: "Collaboratori abilitati", exact: true }).click();
	await page.waitForURL((url) => url.pathname === `/offerte/${offerta.id}/collaboratori`);
	await page.getByRole("main").getByRole("link", { name: "Offerte", exact: true }).click();
	await page.waitForURL((url) => url.pathname === "/offerte" && url.searchParams.get("daPresidiare") === "1");
	await attendiTabellaOfferteIdratata(page);

	// L'eliminazione bloccata offre la disattivazione e conserva lo stesso filtro.
	barra = await selezionaRighe(page, [offerta.codice]);
	await barra.getByRole("button", { name: "Elimina", exact: true }).click();
	await page.getByRole("dialog").getByRole("button", { name: "Disattiva offerta", exact: true }).click();
	await page.waitForURL((url) => url.pathname === "/offerte" && url.searchParams.get("esito") === "stato-offerta-aggiornato");
	await expect(page).toHaveURL((url) => url.searchParams.get("daPresidiare") === "1" && url.searchParams.get("q") === cliente.ragioneSociale);
	await expect(page.getByText("Nessuna offerta da presidiare corrisponde alla ricerca.", { exact: true })).toBeVisible();
	await expect(page.getByRole("link", { name: /\d+ da presidiare/ })).toHaveCount(0);
	await page.getByRole("link", { name: "Mostra tutte le offerte", exact: true }).click();
	await page.waitForURL((url) => !url.searchParams.has("daPresidiare"));
	await expect(page.getByRole("table", { name: "Elenco offerte" }).getByText("Disattivata", { exact: true })).toBeVisible();
});
