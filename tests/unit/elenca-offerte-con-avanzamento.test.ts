import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockOfferta, mockRigaAttivita } = vi.hoisted(() => ({
	mockOfferta: {
		findMany: vi.fn(),
		findUnique: vi.fn(),
	},
	mockRigaAttivita: {
		findMany: vi.fn(),
	},
}));

vi.mock("@/lib/db", () => ({
	db: { offerta: mockOfferta, rigaAttivita: mockRigaAttivita },
}));

const { mockRichiediRuoloApi } = vi.hoisted(() => ({
	mockRichiediRuoloApi: vi.fn(),
}));

vi.mock("@/lib/dal", () => ({
	richiediRuoloApi: mockRichiediRuoloApi,
}));

import {
	elencaOfferteConAvanzamento,
	elencaOffertePerClienteConAvanzamento,
} from "@/lib/offerte";

// ── Builder di supporto ─────────────────────────────────────────

/** Crea una riga `offerta` con cliente incluso, come restituita da Prisma */
function offertaConCliente(
	modifiche: {
		id?: string;
		codice?: string;
		descrizione?: string;
		clienteId?: string;
		ragioneSociale?: string;
		tariffaGiornaliera?: { toString: () => string };
		giorniPrevisti?: number;
		attiva?: boolean;
	} = {},
) {
	const clienteId = modifiche.clienteId ?? "cli-1";
	return {
		id: modifiche.id ?? "off-1",
		codice: modifiche.codice ?? "OFF-001",
		descrizione: modifiche.descrizione ?? "Sviluppo software",
		clienteId,
		// Simula il Decimal Prisma con un oggetto dotato di toString()
		tariffaGiornaliera: modifiche.tariffaGiornaliera ?? { toString: () => "150.00" },
		giorniPrevisti: modifiche.giorniPrevisti ?? 10,
		attiva: modifiche.attiva ?? true,
		createdAt: new Date(),
		updatedAt: new Date(),
		cliente: {
			id: clienteId,
			ragioneSociale: modifiche.ragioneSociale ?? "Cliente Uno",
			attivo: true,
		},
	};
}

/** Crea una riga attività con collaboratore incluso, come restituita da Prisma */
function rigaConCollaboratore(
	modifiche: {
		offertaId?: string;
		collaboratoreId?: string;
		nome?: string;
		cognome?: string;
		ore?: number;
		fatturabile?: boolean;
		data?: Date;
	} = {},
) {
	const collaboratoreId = modifiche.collaboratoreId ?? "collab-1";
	return {
		id: `riga-${collaboratoreId}-${modifiche.offertaId ?? "off-1"}`,
		offertaId: modifiche.offertaId ?? "off-1",
		collaboratoreId,
		ore: modifiche.ore ?? 8,
		fatturabile: modifiche.fatturabile ?? true,
		data: modifiche.data ?? new Date("2026-01-15T00:00:00.000Z"),
		collaboratore: {
			id: collaboratoreId,
			nome: modifiche.nome ?? "Mario",
			cognome: modifiche.cognome ?? "Rossi",
		},
	};
}

describe("elencaOfferteConAvanzamento", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRichiediRuoloApi.mockResolvedValue(undefined);
		mockOfferta.findMany.mockResolvedValue([]);
		mockRigaAttivita.findMany.mockResolvedValue([]);
	});

	// (a) guardia di ruolo ──────────────────────────────────────────

	it("richiede il ruolo AMMINISTRATORE prima di leggere i dati", async () => {
		await elencaOfferteConAvanzamento();

		expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
		expect(mockOfferta.findMany).toHaveBeenCalledWith({
			include: { cliente: true },
		});
		expect(mockRigaAttivita.findMany).toHaveBeenCalledWith({
			include: { collaboratore: true },
		});
	});

	it("propaga l'errore della guardia senza leggere le offerte", async () => {
		mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

		await expect(elencaOfferteConAvanzamento()).rejects.toThrow(
			"Accesso negato",
		);
		expect(mockOfferta.findMany).not.toHaveBeenCalled();
	});

	// (b) offerta con righe fatturabili ─────────────────────────────

	it("calcola erogate/residuo/stato coerenti con calcolaAvanzamentoOfferte per un'offerta con righe fatturabili", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ id: "off-1", codice: "OFF-001", giorniPrevisti: 10 }),
		]);
		// 40 ore fatturabili = 5 giornate su 10 previste → residuo 5, IN_CORSO
		mockRigaAttivita.findMany.mockResolvedValue([
			rigaConCollaboratore({ offertaId: "off-1", ore: 40, fatturabile: true }),
		]);

		const [voce] = await elencaOfferteConAvanzamento();

		expect(voce.offertaId).toBe("off-1");
		expect(voce.giornateErogate).toBe(5);
		expect(voce.residuo).toBe(5);
		expect(voce.stato).toBe("IN_CORSO");
	});

	it("esclude dall'erogato le righe non fatturabili", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ id: "off-1", giorniPrevisti: 10 }),
		]);
		mockRigaAttivita.findMany.mockResolvedValue([
			rigaConCollaboratore({ offertaId: "off-1", ore: 8, fatturabile: true }),
			rigaConCollaboratore({
				offertaId: "off-1",
				collaboratoreId: "collab-2",
				ore: 80,
				fatturabile: false,
			}),
		]);

		const [voce] = await elencaOfferteConAvanzamento();

		expect(voce.giornateErogate).toBe(1);
		expect(voce.residuo).toBe(9);
	});

	it("ripartisce 32 ore fatturabili di due collaboratori su 10 giorni previsti con percentuale 0.4 e dati esatti", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ id: "off-ripartita", giorniPrevisti: 10 }),
		]);
		mockRigaAttivita.findMany.mockResolvedValue([
			rigaConCollaboratore({
				offertaId: "off-ripartita",
				collaboratoreId: "collab-anna",
				nome: "Anna",
				cognome: "Bianchi",
				ore: 16,
			}),
			rigaConCollaboratore({
				offertaId: "off-ripartita",
				collaboratoreId: "collab-bruno",
				nome: "Bruno",
				cognome: "Verdi",
				ore: 16,
			}),
		]);

		const [voce] = await elencaOfferteConAvanzamento();

		expect(voce).toMatchObject({
			offertaId: "off-ripartita",
			giornateErogate: 4,
			residuo: 6,
			percentualeUtilizzo: 0.4,
			stato: "IN_CORSO",
		});
		expect(voce.perCollaboratore).toEqual([
			{
				collaboratoreId: "collab-anna",
				collaboratoreNome: "Anna Bianchi",
				oreErogate: 16,
				giornateErogate: 2,
			},
			{
				collaboratoreId: "collab-bruno",
				collaboratoreNome: "Bruno Verdi",
				oreErogate: 16,
				giornateErogate: 2,
			},
		]);
	});

	it("ripartisce solo le ore fatturabili tra i collaboratori", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ id: "off-mista", giorniPrevisti: 10 }),
		]);
		mockRigaAttivita.findMany.mockResolvedValue([
			rigaConCollaboratore({
				offertaId: "off-mista",
				collaboratoreId: "collab-anna",
				nome: "Anna",
				cognome: "Bianchi",
				ore: 16,
				fatturabile: true,
			}),
			rigaConCollaboratore({
				offertaId: "off-mista",
				collaboratoreId: "collab-bruno",
				nome: "Bruno",
				cognome: "Verdi",
				ore: 80,
				fatturabile: false,
			}),
		]);

		const [voce] = await elencaOfferteConAvanzamento();

		expect(voce).toMatchObject({
			giornateErogate: 2,
			residuo: 8,
			percentualeUtilizzo: 0.2,
		});
		expect(voce.perCollaboratore).toEqual([
			{
				collaboratoreId: "collab-anna",
				collaboratoreNome: "Anna Bianchi",
				oreErogate: 16,
				giornateErogate: 2,
			},
		]);
	});

	it("restituisce avanzamento zero e nessun collaboratore senza attività", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ id: "off-senza-attivita", giorniPrevisti: 10 }),
		]);
		mockRigaAttivita.findMany.mockResolvedValue([]);

		const [voce] = await elencaOfferteConAvanzamento();

		expect(voce).toMatchObject({
			offertaId: "off-senza-attivita",
			giornateErogate: 0,
			residuo: 10,
			percentualeUtilizzo: 0,
			stato: "IN_CORSO",
		});
		expect(voce.perCollaboratore).toEqual([]);
	});

	// (c) offerta senza attività ────────────────────────────────────

	it("per un'offerta senza righe attività riporta erogate 0, residuo = giorni previsti e stato IN_CORSO", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ id: "off-vuota", giorniPrevisti: 7 }),
		]);
		mockRigaAttivita.findMany.mockResolvedValue([]);

		const [voce] = await elencaOfferteConAvanzamento();

		expect(voce.giornateErogate).toBe(0);
		expect(voce.residuo).toBe(7);
		expect(voce.stato).toBe("IN_CORSO");
	});

	// (c-bis) conteggio righe attività ──────────────────────────────

	it("conta tutte le righe attività dell'offerta, incluse le non fatturabili", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ id: "off-1", giorniPrevisti: 10 }),
		]);
		mockRigaAttivita.findMany.mockResolvedValue([
			rigaConCollaboratore({ offertaId: "off-1", ore: 8, fatturabile: true }),
			rigaConCollaboratore({
				offertaId: "off-1",
				collaboratoreId: "collab-2",
				ore: 4,
				fatturabile: false,
			}),
			rigaConCollaboratore({
				offertaId: "off-1",
				collaboratoreId: "collab-3",
				ore: 2,
				fatturabile: false,
			}),
		]);

		const [voce] = await elencaOfferteConAvanzamento();

		expect(voce.numeroRigheAttivita).toBe(3);
	});

	it("riporta numeroRigheAttivita 0 per un'offerta senza righe attività", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ id: "off-vuota", giorniPrevisti: 7 }),
		]);
		mockRigaAttivita.findMany.mockResolvedValue([]);

		const [voce] = await elencaOfferteConAvanzamento();

		expect(voce.numeroRigheAttivita).toBe(0);
	});

	it("conta le righe separatamente per ciascuna offerta", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ id: "off-1", codice: "OFF-001", giorniPrevisti: 10 }),
			offertaConCliente({ id: "off-2", codice: "OFF-002", giorniPrevisti: 10 }),
		]);
		mockRigaAttivita.findMany.mockResolvedValue([
			rigaConCollaboratore({ offertaId: "off-1", ore: 8 }),
			rigaConCollaboratore({
				offertaId: "off-1",
				collaboratoreId: "collab-2",
				ore: 8,
			}),
			rigaConCollaboratore({ offertaId: "off-2", ore: 8 }),
		]);

		const voci = await elencaOfferteConAvanzamento();
		const perId = new Map(voci.map((v) => [v.offertaId, v]));

		expect(perId.get("off-1")!.numeroRigheAttivita).toBe(2);
		expect(perId.get("off-2")!.numeroRigheAttivita).toBe(1);
	});

	// (d) serializzazione tariffa e propagazione attiva ─────────────

	it("serializza la tariffa giornaliera come stringa e propaga il flag attiva", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({
				id: "off-attiva",
				codice: "OFF-ATT",
				tariffaGiornaliera: { toString: () => "150.00" },
				attiva: true,
			}),
			offertaConCliente({
				id: "off-disattiva",
				codice: "OFF-DIS",
				tariffaGiornaliera: { toString: () => "999.50" },
				attiva: false,
			}),
		]);

		const voci = await elencaOfferteConAvanzamento();
		const perId = new Map(voci.map((v) => [v.offertaId, v]));

		const attiva = perId.get("off-attiva")!;
		expect(attiva.tariffaGiornaliera).toBe("150.00");
		expect(typeof attiva.tariffaGiornaliera).toBe("string");
		expect(attiva.attiva).toBe(true);

		const disattiva = perId.get("off-disattiva")!;
		expect(disattiva.tariffaGiornaliera).toBe("999.50");
		expect(disattiva.attiva).toBe(false);
	});

	// (e) ordinamento ───────────────────────────────────────────────

	it("ordina attive critiche prima, poi attive regolari, non attive in coda, con tie-break per ragione sociale poi codice", async () => {
		const offerte = [
			// gruppo 2: attiva regolare, cliente Alfa, codice OFF-B
			offertaConCliente({
				id: "off-attiva-b",
				codice: "OFF-B",
				clienteId: "cli-alfa",
				ragioneSociale: "Alfa",
				giorniPrevisti: 10,
			}),
			// gruppo 3: non attiva
			offertaConCliente({
				id: "off-nonattiva",
				codice: "OFF-Z",
				clienteId: "cli-zeta",
				ragioneSociale: "Zeta",
				giorniPrevisti: 10,
				attiva: false,
			}),
			// gruppo 1: ESAURITA, cliente Beta
			offertaConCliente({
				id: "off-esaurita",
				codice: "OFF-E",
				clienteId: "cli-beta",
				ragioneSociale: "Beta",
				giorniPrevisti: 10,
			}),
			// gruppo 2: attiva regolare, cliente Alfa, codice OFF-A
			offertaConCliente({
				id: "off-attiva-a",
				codice: "OFF-A",
				clienteId: "cli-alfa",
				ragioneSociale: "Alfa",
				giorniPrevisti: 10,
			}),
			// gruppo 1: OLTRE_BUDGET, cliente Alfa
			offertaConCliente({
				id: "off-oltre",
				codice: "OFF-O",
				clienteId: "cli-alfa",
				ragioneSociale: "Alfa",
				giorniPrevisti: 5,
			}),
		];
		mockOfferta.findMany.mockResolvedValue(offerte);
		mockRigaAttivita.findMany.mockResolvedValue([
			// off-esaurita: 80 ore = 10 giornate su 10 → ESAURITA
			rigaConCollaboratore({ offertaId: "off-esaurita", ore: 80 }),
			// off-oltre: 48 ore = 6 giornate su 5 → OLTRE_BUDGET
			rigaConCollaboratore({ offertaId: "off-oltre", ore: 48 }),
		]);

		const voci = await elencaOfferteConAvanzamento();

		expect(voci.map((v) => v.offertaId)).toEqual([
			// gruppo 1 (attive critiche), tie-break ragione sociale poi codice:
			// Alfa/OLTRE_BUDGET prima di Beta/ESAURITA
			"off-oltre",
			"off-esaurita",
			// gruppo 2 (attive regolari), stesso cliente Alfa, per codice OFF-A poi OFF-B
			"off-attiva-a",
			"off-attiva-b",
			// gruppo 3 (non attive)
			"off-nonattiva",
		]);
		expect(voci.find((v) => v.offertaId === "off-esaurita")!.stato).toBe(
			"ESAURITA",
		);
		expect(voci.find((v) => v.offertaId === "off-oltre")!.stato).toBe(
			"OLTRE_BUDGET",
		);
	});

	// (f) matrice mensile ───────────────────────────────────────────

	it("deriva il token mese (YYYY-MM) da RigaAttivita.data in UTC e ordina i mesi crescenti (AC-1)", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ id: "off-1", giorniPrevisti: 10 }),
		]);
		// Stesso collaboratore, due mesi distinti; 2026-03 inserito prima di 2025-12
		// per provare che l'ordinamento è per token e non per ordine di inserimento.
		mockRigaAttivita.findMany.mockResolvedValue([
			rigaConCollaboratore({
				offertaId: "off-1",
				ore: 8,
				data: new Date("2026-03-05T00:00:00.000Z"),
			}),
			rigaConCollaboratore({
				offertaId: "off-1",
				ore: 4,
				data: new Date("2025-12-20T00:00:00.000Z"),
			}),
		]);

		const [voce] = await elencaOfferteConAvanzamento();

		expect(voce.matriceMensile.mesi).toEqual(["2025-12", "2026-03"]);
	});

	it("costruisce una matrice mensile serializzabile con giornate per mese e totali quadrati (AC-2)", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ id: "off-1", giorniPrevisti: 10 }),
		]);
		// 8h a marzo 2026 (1 giornata) e 4h a dicembre 2025 (0.5 giornate)
		// dello stesso collaboratore → totale 1.5 giornate.
		mockRigaAttivita.findMany.mockResolvedValue([
			rigaConCollaboratore({
				offertaId: "off-1",
				collaboratoreId: "collab-1",
				nome: "Mario",
				cognome: "Rossi",
				ore: 8,
				data: new Date("2026-03-05T00:00:00.000Z"),
			}),
			rigaConCollaboratore({
				offertaId: "off-1",
				collaboratoreId: "collab-1",
				nome: "Mario",
				cognome: "Rossi",
				ore: 4,
				data: new Date("2025-12-20T00:00:00.000Z"),
			}),
		]);

		const [voce] = await elencaOfferteConAvanzamento();

		expect(voce.matriceMensile.mesi).toEqual(["2025-12", "2026-03"]);
		expect(voce.matriceMensile.righe).toEqual([
			{
				collaboratoreId: "collab-1",
				collaboratoreNome: "Mario Rossi",
				giornatePerMese: { "2025-12": 0.5, "2026-03": 1 },
				totaleGiornate: 1.5,
			},
		]);
		expect(voce.matriceMensile.totaliPerMese).toEqual({
			"2025-12": 0.5,
			"2026-03": 1,
		});
		expect(voce.matriceMensile.totaleGiornate).toBe(1.5);
		expect(voce.matriceMensile.totaleGiornate).toBe(voce.giornateErogate);
	});

	it("espone una matrice mensile vuota per un'offerta senza righe attività", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ id: "off-vuota", giorniPrevisti: 7 }),
		]);
		mockRigaAttivita.findMany.mockResolvedValue([]);

		const [voce] = await elencaOfferteConAvanzamento();

		expect(voce.matriceMensile).toEqual({
			mesi: [],
			righe: [],
			totaliPerMese: {},
			totaleGiornate: 0,
		});
	});
});

describe("elencaOffertePerClienteConAvanzamento", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRichiediRuoloApi.mockResolvedValue(undefined);
		mockOfferta.findMany.mockResolvedValue([]);
		mockRigaAttivita.findMany.mockResolvedValue([]);
	});

	it("filtra offerte e attività per cliente e restituisce l'avanzamento calcolato", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ clienteId: "cli-1", giorniPrevisti: 10 }),
		]);
		mockRigaAttivita.findMany.mockResolvedValue([
			rigaConCollaboratore({ offertaId: "off-1", ore: 16, fatturabile: true }),
		]);

		const [voce] = await elencaOffertePerClienteConAvanzamento("cli-1");

		expect(mockOfferta.findMany).toHaveBeenCalledWith({
			where: { clienteId: "cli-1" },
			include: { cliente: true },
		});
		expect(mockRigaAttivita.findMany).toHaveBeenCalledWith({
			where: { offerta: { clienteId: "cli-1" } },
			include: { collaboratore: true },
		});
		expect(voce.percentualeUtilizzo).toBe(0.2);
		expect(voce.giornateErogate).toBe(2);
		expect(voce.perCollaboratore).toEqual([
			{
				collaboratoreId: "collab-1",
				collaboratoreNome: "Mario Rossi",
				oreErogate: 16,
				giornateErogate: 2,
			},
		]);
	});

	it("ordina le offerte del cliente per codice crescente", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ id: "off-c", codice: "OFF-C", clienteId: "cli-1" }),
			offertaConCliente({ id: "off-a", codice: "OFF-A", clienteId: "cli-1" }),
			offertaConCliente({ id: "off-b", codice: "OFF-B", clienteId: "cli-1" }),
		]);

		const voci = await elencaOffertePerClienteConAvanzamento("cli-1");

		expect(voci.map((voce) => voce.codice)).toEqual([
			"OFF-A",
			"OFF-B",
			"OFF-C",
		]);
	});

	it("restituisce percentuale zero, ripartizione vuota e residuo previsto senza attività", async () => {
		mockOfferta.findMany.mockResolvedValue([
			offertaConCliente({ clienteId: "cli-1", giorniPrevisti: 7 }),
		]);

		const [voce] = await elencaOffertePerClienteConAvanzamento("cli-1");

		expect(voce.percentualeUtilizzo).toBe(0);
		expect(voce.perCollaboratore).toEqual([]);
		expect(voce.residuo).toBe(7);
	});

	it("propaga l'errore della guardia senza leggere le offerte", async () => {
		mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

		await expect(
			elencaOffertePerClienteConAvanzamento("cli-1"),
		).rejects.toThrow("Accesso negato");
		expect(mockOfferta.findMany).not.toHaveBeenCalled();
	});
});
