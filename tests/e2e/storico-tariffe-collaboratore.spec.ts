import type { Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import {
	attendiConfermaMutazioni,
	avvisoMutazioneNonRiuscita,
	faiFallireAzioniServer,
	trattieniAzioniServer,
} from "./support/mutazioni-ottimistiche";

/**
 * Test e2e — storico tariffe del collaboratore (giornaliera o fisso mensile).
 *
 * Il collaboratore della factory è disattivato: un fisso mensile in vigore di un
 * collaboratore attivo peserebbe come «fisso non attribuibile» sulla
 * marginalità di ogni mese successivo, anche nei mesi riservati di altri test.
 *
 * Salvataggi ed eliminazioni sono immediati: il modulo si chiude e lo storico
 * cambia subito, mentre la sezione resta `aria-busy` fino alla conferma del
 * server. La «Tariffa attuale» in testa alla pagina cambia solo alla conferma.
 */

function sezioneStorico(page: Page) {
	return page.getByRole("region", { name: "Storico tariffe", exact: true });
}

function storico(page: Page) {
	return page.getByRole("table", { name: "Storico tariffe" });
}

function rigaStorico(page: Page, mese: string) {
	return storico(page).locator("tbody tr").filter({ hasText: mese });
}

async function aggiungiTariffa(
	page: Page,
	{ mese, modalita, importo }: { mese: string; modalita: "Giornaliera" | "Fisso mensile"; importo: string },
) {
	await page.getByRole("button", { name: "Nuova tariffa", exact: true }).click();
	const modulo = page.getByRole("form", { name: "Nuova tariffa" });
	await modulo.getByLabel("Valida dal mese").fill(mese);
	await modulo.getByText(modalita, { exact: true }).click();
	await modulo.getByLabel(/^Importo/).fill(importo);
	await modulo.getByRole("button", { name: "Salva tariffa" }).click();
	return modulo;
}

test.describe("Storico tariffe collaboratore", () => {
	test.beforeEach(async ({ page }) => {
		await accediComeAdmin(page);
	});

	test("aggiunge, rifiuta il mese occupato, modifica ed elimina le tariffe mostrando quella in vigore", async ({
		page,
		factory,
	}) => {
		const { collaboratore } = await factory.createCollaboratore({
			attivo: false,
			tariffe: [{ validaDalMese: "2025-01", modalita: "GIORNALIERA", importo: "400.00" }],
		});
		const nomeCompleto = `${collaboratore.nome} ${collaboratore.cognome}`;

		await page.goto(`/anagrafiche/collaboratori/${collaboratore.id}`);
		await expect(page.getByRole("heading", { name: nomeCompleto })).toBeVisible();
		await expect(page.getByTestId("tariffa-attuale")).toContainText("Giornaliera · da gen 2025");

		// Due nuove tariffe: il modulo si chiude a ogni salvataggio riuscito.
		const modulo = await aggiungiTariffa(page, { mese: "2026-01", modalita: "Giornaliera", importo: "450" });
		await expect(modulo).toHaveCount(0);
		await aggiungiTariffa(page, { mese: "2026-07", modalita: "Fisso mensile", importo: "6500" });
		await expect(page.getByRole("form", { name: "Nuova tariffa" })).toHaveCount(0);

		// Storico dalla più recente, con periodi di validità e badge «in vigore».
		await expect(storico(page).locator("tbody tr")).toHaveCount(3);
		await expect(storico(page).locator("tbody tr").first()).toContainText("lug 2026");
		await expect(rigaStorico(page, "lug 2026")).toContainText("in vigore");
		await expect(rigaStorico(page, "lug 2026")).toContainText(/6\.?500,00\s*€\s*\/ mese/);
		await expect(rigaStorico(page, "lug 2026")).toContainText("lug 2026 → in corso");
		await expect(rigaStorico(page, "gen 2026")).toContainText("gen 2026 → giu 2026");
		await expect(rigaStorico(page, "gen 2025")).toContainText("gen 2025 → dic 2025");
		await expect(rigaStorico(page, "gen 2025")).not.toContainText("in vigore");
		await expect(page.getByTestId("tariffa-attuale")).toContainText(/6\.?500,00\s*€\s*\/ mese/);
		await expect(page.getByTestId("tariffa-attuale")).toContainText("Fisso mensile · da lug 2026");

		// Un secondo inserimento sullo stesso mese è rifiutato dal server: la
		// tariffa provvisoria sparisce e il modulo si riapre con valori e messaggio.
		const duplicato = await aggiungiTariffa(page, { mese: "2026-07", modalita: "Giornaliera", importo: "500" });
		await expect(
			duplicato.getByText("Esiste già una tariffa per questo mese: modifica quella"),
		).toBeVisible();
		await expect(duplicato.getByLabel("Valida dal mese")).toHaveValue("2026-07");
		await expect(duplicato.getByLabel(/^Importo/)).toHaveValue("500");
		await expect(storico(page).locator("tbody tr")).toHaveCount(3);
		await duplicato.getByRole("button", { name: "Annulla" }).click();
		await expect(storico(page).locator("tbody tr")).toHaveCount(3);

		// Modifica dell'importo di gennaio 2026.
		await page.getByRole("button", { name: "Modifica tariffa da gen 2026" }).click();
		const modifica = page.getByRole("form", { name: "Modifica tariffa" });
		await expect(modifica.getByLabel(/^Importo/)).toHaveValue("450,00");
		await modifica.getByLabel(/^Importo/).fill("470,00");
		await modifica.getByRole("button", { name: "Salva tariffa" }).click();
		await expect(modifica).toHaveCount(0);
		await expect(rigaStorico(page, "gen 2026")).toContainText(/470,00\s*€\s*\/ giorno/);

		// La voce più vecchia non è eliminabile; le altre sì.
		await expect(page.getByRole("button", { name: "Elimina tariffa da gen 2025" })).toHaveCount(0);
		await page.getByRole("button", { name: "Elimina tariffa da gen 2026" }).click();
		await expect(storico(page).locator("tbody tr")).toHaveCount(2);
		await expect(rigaStorico(page, "gen 2025")).toContainText("gen 2025 → giu 2026");
		await attendiConfermaMutazioni(sezioneStorico(page));

    // La tariffa resta nella scheda unificata dopo una nuova navigazione.
    await page.reload();
    await expect(page.getByTestId("tariffa-attuale")).toContainText(/6\.?500,00\s*€\s*\/ mese/);
	});

	test("la tariffa salvata compare subito in attesa di conferma e l'eliminazione non riuscita la rimette al suo posto", async ({
		page,
		factory,
	}) => {
		const { collaboratore } = await factory.createCollaboratore({
			attivo: false,
			tariffe: [
				{ validaDalMese: "2025-01", modalita: "GIORNALIERA", importo: "400.00" },
				{ validaDalMese: "2026-07", modalita: "GIORNALIERA", importo: "480.00" },
			],
		});

		await page.goto(`/anagrafiche/collaboratori/${collaboratore.id}`);
		await expect(page.getByTestId("tariffa-attuale")).toContainText(/480,00/);
		await expect(storico(page).locator("tbody tr")).toHaveCount(2);
		// Le server action partono dalla scheda persona a cui la pagina reindirizza.
		const percorso = new URL(page.url()).pathname;

		// Con la POST trattenuta il modulo si chiude e la tariffa nuova compare al
		// suo posto, attenuata e senza azioni, con i periodi già ricalcolati; la
		// «Tariffa attuale» aspetta la conferma.
		const trattenute = await trattieniAzioniServer(page, percorso);
		const modulo = await aggiungiTariffa(page, { mese: "2026-03", modalita: "Giornaliera", importo: "455,5" });
		await expect(modulo).toHaveCount(0);

		const rigaNuova = rigaStorico(page, "mar 2026");
		await expect(rigaNuova).toBeVisible();
		await expect(rigaNuova.getByText("Salvataggio…")).toBeVisible();
		await expect(rigaNuova.getByRole("button")).toHaveCount(0);
		await expect(rigaNuova).toContainText(/455,50\s*€\s*\/ giorno/);
		await expect(rigaNuova).toContainText("mar 2026 → giu 2026");
		await expect(storico(page).locator("tbody tr").nth(1)).toContainText("mar 2026");
		await expect(rigaStorico(page, "gen 2025")).toContainText("gen 2025 → feb 2026");
		await expect(sezioneStorico(page)).toHaveAttribute("aria-busy", "true");
		await expect(page.getByTestId("tariffa-attuale")).toContainText(/480,00/);
		await expect.poll(() => trattenute.conteggio()).toBe(1);

		trattenute.rilascia();
		await attendiConfermaMutazioni(sezioneStorico(page));
		await expect(rigaNuova.getByText("Salvataggio…")).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Elimina tariffa da mar 2026" })).toBeVisible();
		await trattenute.smetti();

		// Eliminazione con il server irraggiungibile: la riga sparisce, poi torna
		// al suo posto con un avviso che dice cosa non è riuscito.
		const fallite = await faiFallireAzioniServer(page, percorso);
		await page.getByRole("button", { name: "Elimina tariffa da mar 2026" }).click();
		await attendiConfermaMutazioni(sezioneStorico(page));
		await expect(avvisoMutazioneNonRiuscita(sezioneStorico(page))).toContainText(
			"L'eliminazione della tariffa da mar 2026 non è riuscita",
		);
		await expect(storico(page).locator("tbody tr")).toHaveCount(3);
		await expect(rigaNuova).toContainText("mar 2026 → giu 2026");
		await fallite.smetti();

		// Sul server la tariffa confermata c'è ancora.
		await page.reload();
		await expect(rigaStorico(page, "mar 2026")).toContainText(/455,50\s*€\s*\/ giorno/);
	});
});
