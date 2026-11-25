import { expect, type Locator, type Page, type Request } from "@playwright/test";

/**
 * Elenchi del back office con mutazioni immediate (ingaggi, abilitazioni,
 * storico tariffe, voci di rimborso): l'esito previsto si vede subito, prima
 * che il server risponda. Per osservare l'attesa e il rifiuto senza hard wait,
 * la POST della server action viene trattenuta o fatta fallire da una route
 * sulla pagina, e la conferma si attende sullo stato osservabile `aria-busy`
 * della sezione.
 */

/** POST di una server action: porta l'intestazione `next-action`. */
function eAzioneServer(richiesta: Request): boolean {
	return richiesta.method() === "POST" && richiesta.headers()["next-action"] !== undefined;
}

export type AzioniServerTrattenute = {
	/** Sblocca le POST trattenute e le lascia proseguire verso il server. */
	rilascia: () => void;
	/** Quante POST di server action sono state intercettate finora. */
	conteggio: () => number;
	/** Rimuove l'intercettazione, ripristinando il traffico normale. */
	smetti: () => Promise<void>;
};

/**
 * Trattiene le POST delle server action inviate da `percorso` finché il test
 * non chiama `rilascia()`. Documento, RSC e redirect passano senza modifiche.
 */
export async function trattieniAzioniServer(
	page: Page,
	percorso: string,
): Promise<AzioniServerTrattenute> {
	let rilascia!: () => void;
	const trattenuta = new Promise<void>((risolvi) => {
		rilascia = risolvi;
	});
	let intercettate = 0;
	const rotta = (url: URL) => url.pathname === percorso;

	await page.route(rotta, async (route) => {
		if (eAzioneServer(route.request())) {
			intercettate += 1;
			await trattenuta;
		}
		await route.continue();
	});

	return {
		rilascia,
		conteggio: () => intercettate,
		smetti: async () => {
			rilascia();
			await page.unroute(rotta);
		},
	};
}

export type AzioniServerFallite = {
	/** Quante POST di server action sono state fatte fallire finora. */
	conteggio: () => number;
	/** Rimuove l'intercettazione, ripristinando il traffico normale. */
	smetti: () => Promise<void>;
};

/**
 * Fa fallire a livello di rete (connessione interrotta) le POST delle server
 * action inviate da `percorso`: il server non riceve nulla, quindi i dati non
 * cambiano e la schermata deve tornare com'era con un avviso.
 */
export async function faiFallireAzioniServer(
	page: Page,
	percorso: string,
): Promise<AzioniServerFallite> {
	let fallite = 0;
	const rotta = (url: URL) => url.pathname === percorso;

	await page.route(rotta, async (route) => {
		if (eAzioneServer(route.request())) {
			fallite += 1;
			await route.abort("failed");
			return;
		}
		await route.continue();
	});

	return {
		conteggio: () => fallite,
		smetti: () => page.unroute(rotta),
	};
}

/** Avviso di mutazione non riuscita (role=alert) mostrato dalla sezione. */
export function avvisoMutazioneNonRiuscita(contenitore: Locator | Page): Locator {
	return contenitore.getByTestId("avviso-mutazione-non-riuscita");
}

/**
 * Attende che il server abbia confermato (o rifiutato) tutte le mutazioni in
 * volo della sezione: finché ce n'è una, la sezione è `aria-busy="true"`.
 * Va usata prima di un reload o di una navigazione, che altrimenti potrebbero
 * interrompere la POST ancora in corso.
 */
export async function attendiConfermaMutazioni(sezione: Locator): Promise<void> {
	await expect(sezione).toHaveAttribute("aria-busy", "false");
}
