import { accediAlBackOfficeComeAdmin, accediComeAdmin, accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";
import { sidebar } from "./support/menu-account";
import { navigazionePrincipale, voceNavigazione } from "./support/navigazione";

/**
 * Test e2e — Sidebar comune a collaboratori e amministratori: voci per ruolo
 * raggruppate (Attività; per l'amministratore anche Anagrafica e Reportistica),
 * collassabile a sole icone con la scelta ricordata nel browser, «Registro
 * attività» e «Riepilogo mensile» che seguono il mese e il foglio consultati.
 *
 * Gli scenari navigano senza scrivere righe; il foglio consultato è di un
 * collaboratore creato dalla factory.
 */

const MESE = meseRiservato("INC-SIDEBAR-COMUNE");

test.describe("Sidebar comune", () => {
	test("collaboratore: solo il gruppo Attività con Registro attività e Riepilogo mensile", async ({ page }) => {
		await accediComeCollaboratore(page);

		await expect(navigazionePrincipale(page).getByRole("link")).toHaveText(["Registro attività", "Riepilogo mensile"]);
		await expect(navigazionePrincipale(page).getByText("Attività", { exact: true })).toBeVisible();
		await expect(voceNavigazione(page, "Registro attività")).toHaveAttribute("aria-current", "page");
		await expect(navigazionePrincipale(page).getByRole("link", { name: "Calendario" })).toHaveCount(0);

		// Nella barra del mese resta lo switch Calendario/Elenco, il riepilogo è nella sidebar.
		const vista = page.getByRole("navigation", { name: "Vista delle attività" });
		await expect(vista.getByRole("link", { name: "Calendario", exact: true })).toBeVisible();
		await expect(vista.getByRole("link", { name: "Elenco", exact: true })).toBeVisible();
		await expect(page.getByRole("main").getByRole("link", { name: /Riepilogo/ })).toHaveCount(0);

		await voceNavigazione(page, "Riepilogo mensile").click();
		await page.waitForURL("**/attivita/riepilogo");
		await expect(voceNavigazione(page, "Riepilogo mensile")).toHaveAttribute("aria-current", "page");
		await expect(voceNavigazione(page, "Registro attività")).not.toHaveAttribute("aria-current", "page");
	});

	test("amministratore: gruppi Attività, Anagrafica (con Importazione) e Reportistica", async ({ page }) => {
		await accediComeAdmin(page);

		await expect(navigazionePrincipale(page).getByRole("link")).toHaveText([
			"Registro attività",
			"Riepilogo mensile",
			"Clienti",
			"Offerte",
			"Persone",
			"Voci di rimborso",
			"Importazione",
			"Fatturazione clienti",
			"Fatturazione collaboratori",
			"Marginalità",
		]);
		for (const gruppo of ["Attività", "Anagrafica", "Reportistica"]) {
			await expect(navigazionePrincipale(page).getByText(gruppo, { exact: true })).toBeVisible();
		}
		await expect(navigazionePrincipale(page).getByText("Gestione", { exact: true })).toHaveCount(0);
		await expect(page.getByRole("link", { name: "Console amministrativa" })).toHaveCount(0);

		await voceNavigazione(page, "Marginalità").click();
		await page.waitForURL("**/report/marginalita**");
		await expect(voceNavigazione(page, "Marginalità")).toHaveAttribute("aria-current", "page");
		await voceNavigazione(page, "Registro attività").click();
		await page.waitForURL("**/attivita");
		await expect(voceNavigazione(page, "Registro attività")).toHaveAttribute("aria-current", "page");
	});

	for (const [ruolo, accedi] of [
		["amministratore", accediComeAdmin],
		["collaboratore", accediComeCollaboratore],
	] as const) {
		test(`${ruolo}: la linea sotto il logo è alla stessa altezza di quella dell'intestazione del contenuto`, async ({ page }) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			await accedi(page);

			const intestazioneSidebar = (await sidebar(page).getByTestId("intestazione-sidebar").boundingBox())!;
			const intestazioneContenuto = (await page.getByRole("banner").boundingBox())!;
			// Altezza fissa, quella con la riga «Amministrazione»: non dipende dal ruolo.
			expect(intestazioneSidebar.height).toBe(69);
			expect(intestazioneContenuto.y + intestazioneContenuto.height).toBe(intestazioneSidebar.y + intestazioneSidebar.height);
		});
	}

	test("si collassa a sole icone, resta collassata dopo il ricaricamento e si riespande", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await accediAlBackOfficeComeAdmin(page);
		await expect(page.getByTestId("menu-account")).toHaveAttribute("data-idratata", "true");
		const larghezzaSidebar = async () => (await sidebar(page).boundingBox())!.width;
		expect(await larghezzaSidebar()).toBe(248);

		await sidebar(page).getByRole("button", { name: "Nascondi barra laterale", exact: true }).click();
		await expect.poll(larghezzaSidebar).toBe(64);
		// Le etichette restano come nome accessibile e nel title delle icone.
		await expect(voceNavigazione(page, "Clienti")).toHaveAttribute("title", "Clienti");
		expect((await voceNavigazione(page, "Clienti").boundingBox())!.width).toBeLessThanOrEqual(44);
		const contenuto = (await page.getByRole("main").boundingBox())!;
		expect(contenuto.x).toBe(64);

		await page.reload();
		await expect(sidebar(page).getByRole("button", { name: "Espandi barra laterale", exact: true })).toBeVisible();
		expect(await larghezzaSidebar()).toBe(64);

		await expect(page.getByTestId("menu-account")).toHaveAttribute("data-idratata", "true");
		await sidebar(page).getByRole("button", { name: "Espandi barra laterale", exact: true }).click();
		await expect.poll(larghezzaSidebar).toBe(248);
		await expect(voceNavigazione(page, "Clienti")).not.toHaveAttribute("title", "Clienti");
	});

	test("Riepilogo mensile apre il mese visualizzato, anche dal dettaglio giornata", async ({ page }) => {
		await accediComeCollaboratore(page);

		await page.goto(`/attivita?mese=${MESE}`);
		await expect(voceNavigazione(page, "Riepilogo mensile")).toHaveAttribute("href", `/attivita/riepilogo?mese=${MESE}`);

		await page.goto(`/attivita?mese=${MESE}&vista=elenco`);
		await expect(voceNavigazione(page, "Riepilogo mensile")).toHaveAttribute("href", `/attivita/riepilogo?mese=${MESE}`);

		await page.goto(`/attivita/${dataNelMese(MESE, 10)}?mese=${MESE}`);
		await expect(voceNavigazione(page, "Riepilogo mensile")).toHaveAttribute("href", `/attivita/riepilogo?mese=${MESE}`);
		await voceNavigazione(page, "Riepilogo mensile").click();
		await page.waitForURL(`**/attivita/riepilogo?mese=${MESE}`);
	});

	test("per l'amministratore registro e riepilogo restano sul foglio consultato, in entrambe le direzioni", async ({ page, factory }) => {
		const { collaboratore } = await factory.createCollaboratore();
		await accediComeAdmin(page);

		await page.goto(`/attivita?mese=${MESE}&collaboratore=${collaboratore.id}`);
		await expect(page.getByTestId("banner-foglio-consultato")).toBeVisible();
		await expect(voceNavigazione(page, "Riepilogo mensile")).toHaveAttribute(
			"href",
			`/attivita/riepilogo?mese=${MESE}&collaboratore=${collaboratore.id}`,
		);
		await voceNavigazione(page, "Riepilogo mensile").click();
		await page.waitForURL(`**/attivita/riepilogo?mese=${MESE}&collaboratore=${collaboratore.id}`);
		await expect(page.getByTestId("banner-foglio-consultato")).toBeVisible();

		// E viceversa: dal riepilogo il registro resta sullo stesso foglio e mese.
		await expect(voceNavigazione(page, "Registro attività")).toHaveAttribute(
			"href",
			`/attivita?mese=${MESE}&collaboratore=${collaboratore.id}`,
		);
		await voceNavigazione(page, "Registro attività").click();
		await page.waitForURL(`**/attivita?mese=${MESE}&collaboratore=${collaboratore.id}`);
		await expect(page.getByTestId("banner-foglio-consultato")).toBeVisible();
	});
});
