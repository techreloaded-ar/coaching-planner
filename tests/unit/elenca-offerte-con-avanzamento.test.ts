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

import { elencaOfferteConAvanzamento } from "@/lib/offerte";

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
	} = {},
) {
	const collaboratoreId = modifiche.collaboratoreId ?? "collab-1";
	return {
		id: `riga-${collaboratoreId}-${modifiche.offertaId ?? "off-1"}`,
		offertaId: modifiche.offertaId ?? "off-1",
		collaboratoreId,
		ore: modifiche.ore ?? 8,
		fatturabile: modifiche.fatturabile ?? true,
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
});
