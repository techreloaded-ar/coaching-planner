import { randomUUID } from "node:crypto";

import type { Route } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { cercaNellElenco } from "./support/elenchi";
import { test, expect } from "./support/fixtures";

/**
 * La ricerca degli elenchi paginati non riscrive mai il testo che l'utente sta
 * digitando: la risposta di una ricerca precedente («…A») che arriva quando
 * l'utente ha già scritto e inviato «…AB» lascia il campo su «…AB».
 *
 * Test di sola lettura: cerca un prefisso univoco che non trova nulla.
 */
test.describe("Ricerca negli elenchi durante la digitazione", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("la risposta tardiva di una ricerca precedente non cambia il testo del campo", async ({
		page,
	}) => {
		const prefisso = `rcd${randomUUID().slice(0, 6)}`;
		const primaRicerca = `${prefisso}A`;
		const secondaRicerca = `${prefisso}AB`;
		const campo = page.getByRole("searchbox", { name: "Cerca cliente" });

		await page.goto("/anagrafiche/clienti");
		// Una prima ricerca a idratazione avvenuta: da qui la digitazione arriva a React.
		await cercaNellElenco(page, "/anagrafiche/clienti", prefisso);

		// Trattiene la risposta della prima ricerca finché la seconda non è partita.
		let rilasciaPrima: () => void = () => {};
		const primaTrattenuta = new Promise<void>((risolvi) => {
			void page.route(
				(url) =>
					url.pathname === "/anagrafiche/clienti" &&
					url.searchParams.get("q") === primaRicerca,
				async (route: Route) => {
					risolvi();
					await new Promise<void>((rilascia) => {
						rilasciaPrima = rilascia;
					});
					await route.continue();
				},
			);
		});

		await campo.fill(primaRicerca);
		await primaTrattenuta;

		const secondaInviata = page.waitForRequest(
			(richiesta) => new URL(richiesta.url()).searchParams.get("q") === secondaRicerca,
		);
		await campo.press("B");
		await expect(campo).toHaveValue(secondaRicerca);
		await secondaInviata;

		rilasciaPrima();

		await page.waitForURL(
			(url) =>
				url.pathname === "/anagrafiche/clienti" &&
				url.searchParams.get("q") === secondaRicerca,
		);
		await expect(campo).toHaveValue(secondaRicerca);
	});
});
