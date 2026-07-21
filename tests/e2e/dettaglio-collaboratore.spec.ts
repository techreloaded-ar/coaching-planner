import { accediComeAdmin } from "./support/auth";
import {
	dataNelMese,
	mesePassatoRiservato,
	meseRiservato,
} from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Test e2e — US-038: Dettaglio collaboratore con storico attività
 *
 * Scenari:
 * - Navigazione dalla riga dell'elenco al dettaglio con anagrafica (AC-1),
 *   sezioni mese in italiano ordinate dalla più recente con totali
 *   ore/giornate, righe con cliente/offerta/nota e badge di fatturabilità
 *   (AC-2/AC-3), e link "Modifica" sulla riga che resta intatto (AC-5)
 * - Stato vuoto per un collaboratore senza attività registrate (AC-4)
 */

// Mesi riservati alla spec US-038: mesePrecedente < meseRecente in ordine
// cronologico, così le sezioni del dettaglio hanno un ordinamento atteso stabile.
const meseRecente = meseRiservato("US-038");
const mesePrecedente = mesePassatoRiservato("US-038", 1);

const formattatoreMeseAtteso = new Intl.DateTimeFormat("it-IT", {
	month: "long",
	year: "numeric",
});

// Etichetta sezione mese identica a quella resa dalla UI
// (src/app/(back-office)/anagrafiche/collaboratori/[id]/page.tsx).
function etichettaMeseAttesa(meseToken: string): string {
	const [anno, numeroMese] = meseToken.split("-").map(Number);
	return formattatoreMeseAtteso.format(new Date(anno, numeroMese - 1, 1));
}

// Giorni lontani dai bordi del mese: la pagina formatta la data in ora locale
// del server, quindi mezzanotte UTC non può slittare sul mese adiacente.
function dataNelMeseUtc(meseToken: string, giorno: number): Date {
	return new Date(`${dataNelMese(meseToken, giorno)}T00:00:00.000Z`);
}

function testoLetterale(valore: string): RegExp {
	return new RegExp(valore.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

test.describe("Dettaglio collaboratore", () => {
	test.beforeEach(async ({ page }) => {
		await accediComeAdmin(page);
	});

	test("navigazione dalla riga, gruppi mese con totali e link Modifica intatto", async ({
		page,
		factory,
	}) => {
		const { cliente, offerta } = await factory.createClienteConOfferta();
		const collaboratoreA = await factory.createCollaboratore({
			tariffaGiornaliera: "432.50",
		});
		const idA = collaboratoreA.collaboratore.id;
		const nomeCompletoA = `${collaboratoreA.collaboratore.nome} ${collaboratoreA.collaboratore.cognome}`;
		const notaFatturabile = `Nota fatturabile ${factory.namespace}`;
		const notaIntegrativa = `Nota integrativa ${factory.namespace}`;
		const notaNonFatturabile = `Nota non fatturabile ${factory.namespace}`;

		// Mese recente: 8h + 4h fatturabili → intestazione "12 ore · 1,5 giornate"
		await factory.createRigaAttivita({
			collaboratore: collaboratoreA,
			cliente,
			offerta,
			data: dataNelMeseUtc(meseRecente, 10),
			ore: "8",
			nota: notaFatturabile,
			fatturabile: true,
		});
		await factory.createRigaAttivita({
			collaboratore: collaboratoreA,
			cliente,
			offerta,
			data: dataNelMeseUtc(meseRecente, 12),
			ore: "4",
			nota: notaIntegrativa,
			fatturabile: true,
		});
		// Mese precedente: una riga non fatturabile → "4 ore · 0,5 giornate"
		await factory.createRigaAttivita({
			collaboratore: collaboratoreA,
			cliente,
			offerta,
			data: dataNelMeseUtc(mesePrecedente, 15),
			ore: "4",
			nota: notaNonFatturabile,
			fatturabile: false,
		});

		// Navigazione dalla riga dell'elenco al dettaglio del collaboratore A
		await page.goto("/anagrafiche/collaboratori");
		await expect(
			page.getByRole("heading", { name: "Collaboratori", exact: true }),
		).toBeVisible();

		const rigaA = page.getByRole("row", {
			name: testoLetterale(nomeCompletoA),
		});

		// AC-1 — click generico su una cella neutra della riga (email: senza link
		// né bottoni), che attiva l'handler onClick client-side della <tr>. Il
		// primo click dopo una navigazione documentale può cadere prima
		// dell'idratazione di React ed essere un no-op: ritentiamo con
		// expect.toPass finché la navigazione non è osservabile (un click no-op
		// non muta lo stato, quindi non c'è oscillazione, nessun hard wait).
		const cellaEmailA = rigaA.getByRole("cell", {
			name: collaboratoreA.utente.email,
			exact: true,
		});
		await expect(async () => {
			await cellaEmailA.click();
			await expect(page).toHaveURL(
				new RegExp(`/anagrafiche/collaboratori/${idA}$`),
				{ timeout: 1_000 },
			);
		}).toPass({ timeout: 15_000 });

		// Ritorno all'elenco e click sul link del nome: affordance primaria con
		// href nativo, che resta la via di navigazione esplicita
		await page
			.getByRole("main")
			.getByRole("link", { name: "Collaboratori", exact: true })
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/collaboratori$/);
		await expect(
			page.getByRole("heading", { name: "Collaboratori", exact: true }),
		).toBeVisible();

		await page
			.getByRole("row", { name: testoLetterale(nomeCompletoA) })
			.getByRole("link", { name: nomeCompletoA, exact: true })
			.click();
		await expect(page).toHaveURL(
			new RegExp(`/anagrafiche/collaboratori/${idA}$`),
		);

		// AC-1 — intestazione con nome completo, email e tariffa formattata
		await expect(
			page.getByRole("heading", { name: nomeCompletoA }),
		).toBeVisible();
		await expect(
			page.getByText(collaboratoreA.utente.email, { exact: true }),
		).toBeVisible();
		await expect(page.getByText(/432,50\s*€/)).toBeVisible();

		// AC-2/AC-3 — due sezioni mese con etichetta italiana, ordinate dalla
		// più recente, con totali di ore/giornate e badge di fatturabilità
		const etichettaRecente = etichettaMeseAttesa(meseRecente);
		const etichettaPrecedente = etichettaMeseAttesa(mesePrecedente);

		const tabelleMese = page.getByRole("table", { name: /^Attività di / });
		await expect(tabelleMese).toHaveCount(2);
		await expect(tabelleMese.nth(0)).toHaveAttribute(
			"aria-label",
			`Attività di ${etichettaRecente}`,
		);
		await expect(tabelleMese.nth(1)).toHaveAttribute(
			"aria-label",
			`Attività di ${etichettaPrecedente}`,
		);

		const tabellaRecente = page.getByRole("table", {
			name: `Attività di ${etichettaRecente}`,
			exact: true,
		});
		const tabellaPrecedente = page.getByRole("table", {
			name: `Attività di ${etichettaPrecedente}`,
			exact: true,
		});

		const sezioneRecente = page
			.locator("section")
			.filter({ has: tabellaRecente });
		await expect(
			sezioneRecente.getByText(etichettaRecente, { exact: true }),
		).toBeVisible();
		await expect(
			sezioneRecente.getByText("12 ore · 1,5 giornate", { exact: true }),
		).toBeVisible();

		const rigaConNota = tabellaRecente.getByRole("row", {
			name: testoLetterale(notaFatturabile),
		});
		await expect(rigaConNota).toContainText(cliente.ragioneSociale);
		await expect(rigaConNota).toContainText(offerta.codice);
		await expect(
			rigaConNota.getByRole("cell", { name: "8", exact: true }),
		).toBeVisible();
		await expect(
			rigaConNota.getByText("Fatturabile", { exact: true }),
		).toBeVisible();
		await expect(rigaConNota).toContainText(notaFatturabile);

		const sezionePrecedente = page
			.locator("section")
			.filter({ has: tabellaPrecedente });
		await expect(
			sezionePrecedente.getByText("4 ore · 0,5 giornate", { exact: true }),
		).toBeVisible();

		const rigaNonFatturabile = tabellaPrecedente.getByRole("row", {
			name: testoLetterale(notaNonFatturabile),
		});
		await expect(
			rigaNonFatturabile.getByText("Non fatturabile", { exact: true }),
		).toBeVisible();

		// AC-5 — ritorno all'elenco: il link Modifica sulla riga di A porta al
		// form di modifica e non viene catturato dalla navigazione di riga
		await page
			.getByRole("main")
			.getByRole("link", { name: "Collaboratori", exact: true })
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/collaboratori$/);

		const rigaElencoA = page.getByRole("row", {
			name: testoLetterale(nomeCompletoA),
		});
		await rigaElencoA.getByRole("link", { name: "Modifica" }).click();
		await expect(page).toHaveURL(
			new RegExp(`/anagrafiche/collaboratori/${idA}/modifica$`),
		);
		await expect(
			page.getByRole("heading", { name: "Modifica collaboratore" }),
		).toBeVisible();
	});

	test("stato vuoto per collaboratore senza attività", async ({
		page,
		factory,
	}) => {
		const collaboratoreB = await factory.createCollaboratore();
		const idB = collaboratoreB.collaboratore.id;
		const nomeCompletoB = `${collaboratoreB.collaboratore.nome} ${collaboratoreB.collaboratore.cognome}`;

		// Navigazione dalla riga dell'elenco al dettaglio del collaboratore B
		await page.goto("/anagrafiche/collaboratori");
		const rigaB = page.getByRole("row", {
			name: testoLetterale(nomeCompletoB),
		});
		await rigaB.getByRole("link", { name: nomeCompletoB, exact: true }).click();
		await expect(page).toHaveURL(
			new RegExp(`/anagrafiche/collaboratori/${idB}$`),
		);

		// AC-4 — messaggio di stato vuoto senza sezioni mese
		await expect(
			page.getByText("Nessuna attività registrata per questo collaboratore.", {
				exact: true,
			}),
		).toBeVisible();
		// Le tabelle dello storico hanno aria-label "Attività di <mese>": in
		// stato vuoto non ne deve esistere nessuna
		await expect(
			page.getByRole("table", { name: /Attività di/ }),
		).toHaveCount(0);
	});
});
