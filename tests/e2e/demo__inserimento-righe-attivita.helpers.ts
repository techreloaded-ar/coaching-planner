import { expect, type Locator, type Page } from "@playwright/test";

import { accediComeCollaboratore } from "./support/auth";
import {
	dataNelMese,
	meseCorrenteToken,
	mesePassatoToken,
} from "./support/date";
import type { ClienteConOffertaTestData } from "./support/fixtures";

export async function loginComeGiulia(page: Page) {
	await accediComeCollaboratore(page);
}

export function dataOggiOffset(giorno: number): string {
	return dataNelMese(meseCorrenteToken(), giorno);
}

export function dataMesePrecedenteGiorno(giorno: number): string {
	return dataNelMese(mesePassatoToken(), giorno);
}

export function labelOffertaTest(clienteConOfferta: ClienteConOffertaTestData) {
	return `${clienteConOfferta.offerta.codice} — ${clienteConOfferta.offerta.descrizione}`;
}

export async function attendiOfferteCaricate(selectOfferta: Locator) {
	await expect(selectOfferta).toBeEnabled();
	await expect
		.poll(async () => selectOfferta.locator("option").count())
		.toBeGreaterThan(1);
}

export async function selezionaClienteEOffertaTest(
	page: Page,
	clienteConOfferta: ClienteConOffertaTestData,
) {
	const selectCliente = page.locator("#cliente");
	const selectOfferta = page.locator("#offerta");
	const clienteLabel = clienteConOfferta.cliente.ragioneSociale;
	const offertaLabel = labelOffertaTest(clienteConOfferta);

	await expect(selectCliente).toContainText(clienteLabel);
	await selectCliente.selectOption(clienteConOfferta.cliente.id);
	await expect(selectCliente).toHaveValue(clienteConOfferta.cliente.id);

	await attendiOfferteCaricate(selectOfferta);
	await expect(selectOfferta).toContainText(offertaLabel);
	await selectOfferta.selectOption(clienteConOfferta.offerta.id);
	await expect(selectOfferta).toHaveValue(clienteConOfferta.offerta.id);
}
