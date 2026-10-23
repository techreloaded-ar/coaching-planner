/**
 * Oracolo T1 · livello integrazione. Titoli "[area] CODICE descrizione".
 * Ogni test crea i propri clienti con la factory e verifica la persistenza, mai il messaggio.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { createE2eDataFactory, type CollaboratoreTestData } from "../tests/e2e/support/factory";
import { mesePassatoRiservato } from "../tests/e2e/support/date";
import { e2ePrisma } from "../tests/e2e/support/prisma";
import { come, creaUtenteCliente, dataUtc, giornoDi, tenta, utenteDi } from "./shared/integrazione";
import type { ReferenteInput, ReferentePersistito, UtenteSessione } from "./contratto";
import { adattatoreIntegrazione as adattatore } from "./adattatore/integrazione";

const factory = createE2eDataFactory(`oracolo-t1-int-${process.pid}-${Date.now()}`);
let amministratore: UtenteSessione;
let collaboratore: CollaboratoreTestData;
let progressivo = 0;

const VUOTO: ReferenteInput = { nome: "", email: "", telefono: "" };

function unico(): string {
	progressivo += 1;
	return `${process.pid}${Date.now().toString(36)}${progressivo}`;
}

function anagrafica(): { ragioneSociale: string; partitaIva: string } {
	const codice = unico();
	const cifre = codice.replace(/\D/g, "").padEnd(11, "7").slice(-11);
	return { ragioneSociale: `Oracolo T1 Cliente ${codice}`, partitaIva: cifre };
}

function referenteCompleto(): ReferenteInput {
	const codice = unico();
	return { nome: `Maria Bianchi ${codice}`, email: `maria.bianchi.${codice}@cliente-oracolo.it`, telefono: "+39 011 5551234" };
}

/** Assente = colonna NULL o stringa vuota (scelta di rappresentazione libera della consegna). */
function assente(valore: string | null): boolean {
	return valore === null || valore === "";
}

function soloCifre(valore: string | null): string {
	return (valore ?? "").replace(/[^\d+]/g, "");
}

async function idClientePerRagioneSociale(ragioneSociale: string): Promise<string[]> {
	const { rows } = await e2ePrisma.query(`SELECT "id" FROM "Cliente" WHERE "ragioneSociale" = $1`, [ragioneSociale]);
	return rows.map((r) => r.id as string);
}

async function creaComeAmministratore(referente: ReferenteInput): Promise<string | null> {
	const dati = anagrafica();
	await come(amministratore);
	await tenta(() => adattatore.creaCliente(dati, referente));
	const ids = await idClientePerRagioneSociale(dati.ragioneSociale);
	return ids[0] ?? null;
}

/** Cliente già esistente (factory, colonne baseline) con referente impostato dall'amministratore. */
async function clienteConReferente(referente: ReferenteInput): Promise<string> {
	const cliente = await factory.createCliente();
	await come(amministratore);
	await tenta(() => adattatore.aggiornaReferente(cliente.id, referente));
	const persistito = await adattatore.referentePersistito(cliente.id);
	expect(persistito.nome, "precondizione: l'amministratore imposta il referente").toBe(referente.nome);
	return cliente.id;
}

beforeAll(async () => {
	const admin = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
	amministratore = utenteDi({ utente: admin });
	collaboratore = await factory.createCollaboratore();
});

// ── referente (5) ───────────────────────────────────────────────────────────

describe("referente", () => {
	test("[referente] R1 creazione cliente con referente completo e lettura dei tre valori", async () => {
		const referente = referenteCompleto();
		const id = await creaComeAmministratore(referente);
		expect(id, "cliente creato").not.toBeNull();
		const persistito = await adattatore.referentePersistito(id!);
		expect(persistito.nome).toBe(referente.nome);
		expect(persistito.email?.toLowerCase()).toBe(referente.email);
		expect(soloCifre(persistito.telefono)).toBe("+390115551234");
	});

	test("[referente] R2 cliente senza referente resta valido", async () => {
		const id = await creaComeAmministratore(VUOTO);
		expect(id, "cliente creato senza referente").not.toBeNull();
		const persistito = await adattatore.referentePersistito(id!);
		expect(assente(persistito.nome) && assente(persistito.email) && assente(persistito.telefono)).toBe(true);
	});

	test("[referente] R3 nome, email e telefono salvabili separatamente", async () => {
		const completo = referenteCompleto();
		const soloNome = await creaComeAmministratore({ ...VUOTO, nome: completo.nome });
		const soloEmail = await creaComeAmministratore({ ...VUOTO, email: completo.email });
		const soloTelefono = await creaComeAmministratore({ ...VUOTO, telefono: completo.telefono });
		expect([soloNome, soloEmail, soloTelefono].every(Boolean), "tre clienti creati").toBe(true);

		const n = await adattatore.referentePersistito(soloNome!);
		expect(n.nome).toBe(completo.nome);
		expect(assente(n.email) && assente(n.telefono)).toBe(true);
		const e = await adattatore.referentePersistito(soloEmail!);
		expect(e.email?.toLowerCase()).toBe(completo.email);
		expect(assente(e.nome) && assente(e.telefono)).toBe(true);
		const t = await adattatore.referentePersistito(soloTelefono!);
		expect(soloCifre(t.telefono)).toBe("+390115551234");
		expect(assente(t.nome) && assente(t.email)).toBe(true);
	});

	test("[referente] R4 modifica referente esistente persiste", async () => {
		const id = await clienteConReferente(referenteCompleto());
		const nuovo = { nome: `Luca Verdi ${unico()}`, email: `luca.verdi.${unico()}@cliente-oracolo.it`, telefono: "02 7654321" };
		await come(amministratore);
		await tenta(() => adattatore.aggiornaReferente(id, nuovo));
		const persistito = await adattatore.referentePersistito(id);
		expect(persistito.nome).toBe(nuovo.nome);
		expect(persistito.email?.toLowerCase()).toBe(nuovo.email);
		expect(soloCifre(persistito.telefono)).toBe("027654321");
	});

	test("[referente] R5 rimozione dei tre campi ripristina assenza referente", async () => {
		const id = await clienteConReferente(referenteCompleto());
		await come(amministratore);
		await tenta(() => adattatore.aggiornaReferente(id, VUOTO));
		const persistito = await adattatore.referentePersistito(id);
		expect(assente(persistito.nome) && assente(persistito.email) && assente(persistito.telefono)).toBe(true);
		expect(await adattatore.clientePerDettaglio(id), "il cliente resta leggibile senza referente").not.toBeNull();
	});
});

// ── validazione (4) ─────────────────────────────────────────────────────────

describe("validazione", () => {
	test("[validazione] V1 email malformata rifiutata senza scrittura", async () => {
		const valido = referenteCompleto();
		const id = await clienteConReferente(valido);
		await come(amministratore);
		await tenta(() => adattatore.aggiornaReferente(id, { ...valido, email: "maria.bianchi@" }));
		expect((await adattatore.referentePersistito(id)).email?.toLowerCase()).toBe(valido.email);

		const nuovo = anagrafica();
		await tenta(() => adattatore.creaCliente(nuovo, { ...referenteCompleto(), email: "maria.bianchi.cliente-oracolo.it" }));
		expect(await idClientePerRagioneSociale(nuovo.ragioneSociale)).toHaveLength(0);
	});

	test("[validazione] V2 telefono malformato rifiutato senza scrittura", async () => {
		const valido = referenteCompleto();
		const id = await clienteConReferente(valido);
		await come(amministratore);
		await tenta(() => adattatore.aggiornaReferente(id, { ...valido, telefono: "non disponibile" }));
		expect(soloCifre((await adattatore.referentePersistito(id)).telefono)).toBe("+390115551234");

		const nuovo = anagrafica();
		await tenta(() => adattatore.creaCliente(nuovo, { ...referenteCompleto(), telefono: "chiamare la segreteria" }));
		expect(await idClientePerRagioneSociale(nuovo.ragioneSociale)).toHaveLength(0);
	});

	test("[validazione] V3 nome composto solo da spazi trattato come assente", async () => {
		const completo = referenteCompleto();
		const id = await creaComeAmministratore({ nome: "    ", email: completo.email, telefono: "" });
		expect(id, "cliente creato: un nome di soli spazi non è un errore ma un'assenza").not.toBeNull();
		const persistito = await adattatore.referentePersistito(id!);
		expect(assente(persistito.nome)).toBe(true);
		expect(persistito.email?.toLowerCase()).toBe(completo.email);
	});

	test("[validazione] V4 email con plus e sottodominio accettata", async () => {
		const email = `mario.rossi+fatture${unico()}@amministrazione.cliente-oracolo.it`;
		const id = await creaComeAmministratore({ nome: "Mario Rossi", email, telefono: "" });
		expect(id, "cliente creato").not.toBeNull();
		expect((await adattatore.referentePersistito(id!)).email?.toLowerCase()).toBe(email);
	});
});

// ── autorizzazioni (3) ──────────────────────────────────────────────────────

describe("autorizzazioni", () => {
	async function tentativoDa(utente: UtenteSessione | null): Promise<void> {
		const originale = referenteCompleto();
		const id = await clienteConReferente(originale);
		const nuovaAnagrafica = anagrafica();
		await come(utente);
		await tenta(() => adattatore.aggiornaReferente(id, { nome: "Intruso", email: "intruso@esempio.it", telefono: "3331234567" }));
		await tenta(() => adattatore.creaCliente(nuovaAnagrafica, referenteCompleto()));
		const persistito = await adattatore.referentePersistito(id);
		expect(persistito.nome).toBe(originale.nome);
		expect(persistito.email?.toLowerCase()).toBe(originale.email);
		expect(await idClientePerRagioneSociale(nuovaAnagrafica.ragioneSociale)).toHaveLength(0);
	}

	test("[autorizzazioni] A1 collaboratore non modifica referente", async () => {
		await tentativoDa(utenteDi(collaboratore));
	});

	test("[autorizzazioni] A2 utente anonimo non modifica referente", async () => {
		await tentativoDa(null);
	});

	test("[autorizzazioni] A3 cliente non modifica referente", async () => {
		await tentativoDa(await creaUtenteCliente(factory, adattatore.ruoloUtenteCliente ?? "COLLABORATORE"));
	});
});

// ── persistenza (P3, P4; P1 e P2 nel gate) ─────────────────────────────────

describe("persistenza", () => {
	test("[persistenza] P3 report fatturazione invariato prima/dopo inserimento referente", async () => {
		const token = mesePassatoRiservato("ORACOLO-T1-P3");
		const { cliente, offerta } = await factory.createClienteConOfferta({}, { tariffaGiornaliera: "640.00" });
		await factory.createAbilitazioneOfferta({ collaboratore, offerta });
		await factory.createRigaAttivita({ collaboratore, cliente, offerta, data: dataUtc(giornoDi(token, 5)), ore: "8" });
		await factory.createRigaAttivita({
			collaboratore,
			cliente,
			offerta,
			data: dataUtc(giornoDi(token, 6)),
			ore: "3",
			rimborsoTrasfertaEtichetta: "Trasferta oracolo",
			rimborsoTrasfertaImporto: "42.50",
		});
		await come(amministratore);
		const prima = await adattatore.importiFatturazioneCliente(token, cliente.id);
		expect(prima, "il cliente compare nel report").not.toBeNull();
		expect(prima!.importoTotale).toBeCloseTo(640 + 240 + 42.5, 6);

		await tenta(() => adattatore.aggiornaReferente(cliente.id, referenteCompleto()));
		expect(assente((await adattatore.referentePersistito(cliente.id)).nome)).toBe(false);
		await come(amministratore);
		expect(await adattatore.importiFatturazioneCliente(token, cliente.id)).toEqual(prima);
	});

	test("[persistenza] P4 anagrafica cliente esistente senza referente leggibile", async () => {
		// Inserito con le sole colonne della baseline: rappresenta un cliente creato prima della migrazione.
		const cliente = await factory.createCliente();
		await come(amministratore);
		const letto = await adattatore.clientePerDettaglio(cliente.id);
		expect(letto).not.toBeNull();
		expect(letto!.ragioneSociale).toBe(cliente.ragioneSociale);
		const referente: ReferentePersistito = letto!.referente;
		expect(assente(referente.nome) && assente(referente.email) && assente(referente.telefono)).toBe(true);
	});
});
