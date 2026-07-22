import {
	EMAIL_COLLABORATORE_E2E,
	accediCome,
	accediComeAdmin,
} from "./support/auth";
import { e2ePrisma } from "./support/prisma";
import { test, expect } from "./support/fixtures";

/**
 * Test e2e — US-042: Abilitazione dei collaboratori sulle offerte dal
 * dettaglio collaboratore.
 *
 * Scenari:
 * - Elenco delle sole offerte abilitate con codice e cliente, abilitazione
 *   multipla via ricerca e selezione persistita dopo reload, revoca che lascia
 *   invariate le altre abilitazioni (AC-1/AC-2/AC-3)
 * - Pre-popolamento iniziale del seed: Giulia Conti già abilitata su TS-2025-01
 *   senza alcuna azione manuale (AC-4)
 * - Accesso negato per un utente con ruolo collaboratore, con lo stesso
 *   redirect del back office (AC-5)
 */

test.describe("Abilitazioni collaboratore", () => {
	test("elenco, abilitazione multipla persistita e revoca (AC-1/AC-2/AC-3)", async ({
		page,
		factory,
	}) => {
		// Marcatore condiviso e univoco per questo test: rende i codici delle
		// offerte A/B/C ricercabili insieme senza intercettare le offerte di
		// altri worker o del seed presenti nel dialog.
		const marcatore = `U42${factory.namespace}`
			.replace(/[^a-z0-9]/gi, "")
			.toUpperCase();
		const codiceOffertaA = `${marcatore}A`;
		const codiceOffertaB = `${marcatore}B`;
		const codiceOffertaC = `${marcatore}C`;

		const { cliente: clienteA, offerta: offertaA } =
			await factory.createClienteConOfferta(
				{ ragioneSociale: `Cliente A ${marcatore}` },
				{ codice: codiceOffertaA },
			);
		const { offerta: offertaB } = await factory.createClienteConOfferta(
			{ ragioneSociale: `Cliente B ${marcatore}` },
			{ codice: codiceOffertaB },
		);
		const { offerta: offertaC } = await factory.createClienteConOfferta(
			{ ragioneSociale: `Cliente C ${marcatore}` },
			{ codice: codiceOffertaC },
		);
		void offertaB;
		void offertaC;

		const collaboratore = await factory.createCollaboratore();
		const idCollaboratore = collaboratore.collaboratore.id;

		// Pre-popolamento simulato: il collaboratore parte già abilitato su A.
		await factory.createAbilitazioneOfferta({
			collaboratore,
			offerta: offertaA,
		});

		await accediComeAdmin(page);
		await page.goto(`/anagrafiche/collaboratori/${idCollaboratore}`);

		const tabellaAbilitate = page.getByRole("table", {
			name: "Offerte abilitate",
			exact: true,
		});

		// AC-1 — l'elenco mostra la sola offerta A (codice + cliente) e non le
		// offerte non ancora abilitate B e C.
		const rigaA = tabellaAbilitate.getByRole("row", { name: codiceOffertaA });
		await expect(rigaA).toBeVisible();
		await expect(rigaA).toContainText(clienteA.ragioneSociale);
		await expect(tabellaAbilitate).not.toContainText(codiceOffertaB);
		await expect(tabellaAbilitate).not.toContainText(codiceOffertaC);

		// AC-2 — apertura del dialog. Il primo click dopo la navigazione
		// documentale può cadere prima dell'idratazione (handler client-side): il
		// click imposta lo stato "aperto" in modo idempotente, quindi ritentiamo
		// con expect.toPass finché il dialog non è osservabile, senza oscillazioni.
		const dialog = page.getByRole("dialog");
		await expect(async () => {
			await page
				.getByRole("button", { name: "Abilita offerte", exact: true })
				.click();
			await expect(dialog).toBeVisible({ timeout: 1_000 });
		}).toPass({ timeout: 15_000 });

		// Flusso naturale a due ricerche distinte: cerca B, selezionala; poi
		// cambia la ricerca su C (che smonta e rimonta le righe filtrate, con B
		// ora fuori dai risultati) e selezionala. La selezione di B deve
		// sopravvivere al cambio di filtro grazie agli input nascosti che
		// mantengono in submit le offerte selezionate ma non più visibili.
		const campoRicerca = dialog.getByRole("searchbox", { name: "Cerca offerta" });
		await campoRicerca.fill(codiceOffertaB);
		await dialog.getByRole("checkbox", { name: codiceOffertaB }).check();
		await campoRicerca.fill(codiceOffertaC);
		await expect(dialog.getByRole("checkbox", { name: codiceOffertaB })).toHaveCount(0);
		await dialog.getByRole("checkbox", { name: codiceOffertaC }).check();
		await dialog
			.getByRole("button", { name: "Abilita selezionate", exact: true })
			.click();

		// Attesa web-first: B e C compaiono nell'elenco delle abilitate.
		await expect(
			tabellaAbilitate.getByRole("row", { name: codiceOffertaB }),
		).toBeVisible();
		await expect(
			tabellaAbilitate.getByRole("row", { name: codiceOffertaC }),
		).toBeVisible();

		// AC-2 — la selezione multipla sopravvive al ricaricamento.
		await page.reload();
		await expect(
			tabellaAbilitate.getByRole("row", { name: codiceOffertaA }),
		).toBeVisible();
		await expect(
			tabellaAbilitate.getByRole("row", { name: codiceOffertaB }),
		).toBeVisible();
		await expect(
			tabellaAbilitate.getByRole("row", { name: codiceOffertaC }),
		).toBeVisible();

		// AC-3 — revoca della sola abilitazione B. Prima interazione dopo il
		// reload: la submit del form con action client-side è un no-op finché non
		// è idratata, quindi ritentiamo (la revoca è idempotente).
		await expect(async () => {
			await tabellaAbilitate
				.getByRole("row", { name: codiceOffertaB })
				.getByRole("button", { name: "Revoca", exact: true })
				.click();
			await expect(
				tabellaAbilitate.getByRole("row", { name: codiceOffertaB }),
			).toHaveCount(0, { timeout: 1_000 });
		}).toPass({ timeout: 15_000 });

		// AC-3 — dopo il reload B resta assente mentre A e C sono invariate.
		await page.reload();
		await expect(
			tabellaAbilitate.getByRole("row", { name: codiceOffertaB }),
		).toHaveCount(0);
		await expect(
			tabellaAbilitate.getByRole("row", { name: codiceOffertaA }),
		).toBeVisible();
		await expect(
			tabellaAbilitate.getByRole("row", { name: codiceOffertaC }),
		).toBeVisible();
	});

	test("pre-popolamento iniziale sul seed: Giulia Conti abilitata su TS-2025-01 (AC-4)", async ({
		page,
	}) => {
		// Lettura in sola lettura dell'id del Collaboratore seed via email utente:
		// nessuna scrittura, nessuna mutazione delle entità di seed.
		const risultato = await e2ePrisma.query<{ id: string }>(
			`SELECT c."id"
			   FROM "Collaboratore" c
			   JOIN "Utente" u ON u."id" = c."userId"
			  WHERE u."email" = $1`,
			[EMAIL_COLLABORATORE_E2E],
		);
		const idCollaboratoreSeed = risultato.rows[0]?.id;
		expect(idCollaboratoreSeed).toBeTruthy();

		await accediComeAdmin(page);
		await page.goto(`/anagrafiche/collaboratori/${idCollaboratoreSeed}`);

		const tabellaAbilitate = page.getByRole("table", {
			name: "Offerte abilitate",
			exact: true,
		});
		await expect(
			tabellaAbilitate.getByRole("row", { name: "TS-2025-01" }),
		).toBeVisible();
	});

	test("accesso negato per il ruolo collaboratore (AC-5)", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();

		await accediCome(page, collaboratore.utente.email);
		await page.goto(
			`/anagrafiche/collaboratori/${collaboratore.collaboratore.id}`,
		);

		await expect(page).toHaveURL(/\/attivita$/);
	});
});
