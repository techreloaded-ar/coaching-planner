import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Elenchi paginati del back-office (clienti, offerte): mostrano 25 righe per
 * pagina e cercano lato server con il parametro `q`. Con la suite in parallelo
 * le righe create dalla factory possono finire oltre la prima pagina, quindi
 * un test che cerca una propria riga deve sempre filtrare l'elenco.
 */

type PercorsoElenco = "/offerte" | "/anagrafiche/clienti";

const ETICHETTA_RICERCA: Record<PercorsoElenco, string> = {
	"/offerte": "Cerca offerta",
	"/anagrafiche/clienti": "Cerca cliente",
};

/** URL dell'elenco filtrato per `ricerca`, con eventuali altri parametri. */
export function urlElencoFiltrato(
	percorso: PercorsoElenco,
	ricerca: string,
	altriParametri: Record<string, string> = {},
): string {
	const parametri = new URLSearchParams({ ...altriParametri, q: ricerca });
	return `${percorso}?${parametri.toString()}`;
}

/** Apre direttamente l'elenco già filtrato per `ricerca`. */
export async function apriElencoFiltrato(
	page: Page,
	percorso: PercorsoElenco,
	ricerca: string,
): Promise<void> {
	await page.goto(urlElencoFiltrato(percorso, ricerca));
	await expect(
		page.getByRole("searchbox", { name: ETICHETTA_RICERCA[percorso] }),
	).toHaveValue(ricerca);
}

/**
 * Cerca dalla searchbox dell'elenco e attende che l'URL porti `q=testo`.
 * La ricerca parte solo a idratazione avvenuta: una digitazione sull'HTML
 * server-rendered non arriva a React, quindi si ripete finché l'URL non cambia
 * (polling su stato osservabile, nessuna attesa fissa).
 */
export async function cercaNellElenco(
	page: Page,
	percorso: PercorsoElenco,
	testo: string,
): Promise<void> {
	const campo = page.getByRole("searchbox", {
		name: ETICHETTA_RICERCA[percorso],
	});
	await expect(async () => {
		await campo.clear();
		await campo.fill(testo);
		await page.waitForURL(
			(url) =>
				url.pathname === percorso && url.searchParams.get("q") === testo,
			{ timeout: 3_000 },
		);
	}).toPass();
	await expect(campo).toHaveValue(testo);
}

/**
 * Elenchi con selezione (clienti, offerte, utenti): ogni riga ha una checkbox
 * «Seleziona <nome>» e, con almeno un elemento selezionato, la barra di
 * ricerca è sostituita da quella delle azioni sulla selezione.
 */
export function barraSelezione(page: Page): Locator {
	return page.getByRole("group", { name: "Azioni sulla selezione" });
}

export function casellaSelezione(page: Page, nome: string): Locator {
	return page.getByRole("checkbox", { name: `Seleziona ${nome}`, exact: true });
}

/**
 * Seleziona le righe indicate (per nome, o direttamente con il locator della
 * loro casella) e restituisce la barra delle azioni.
 * Le caselle sono disabilitate fino all'idratazione: `check()` attende che
 * siano abilitate, quindi il click arriva sempre a React.
 */
export async function selezionaRighe(
	page: Page,
	righe: Array<string | Locator>,
): Promise<Locator> {
	for (const riga of righe) {
		await (typeof riga === "string" ? casellaSelezione(page, riga) : riga).check();
	}
	const barra = barraSelezione(page);
	await expect(barra).toBeVisible();
	return barra;
}
