import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockOfferta, mockRigaAttivita } = vi.hoisted(() => ({
	mockOfferta: {
		update: vi.fn(),
		delete: vi.fn(),
	},
	mockRigaAttivita: {
		count: vi.fn(),
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

const { mockRevalidatePath } = vi.hoisted(() => ({
	mockRevalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
	revalidatePath: mockRevalidatePath,
}));

const { mockRedirect } = vi.hoisted(() => ({
	mockRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	redirect: mockRedirect,
}));

import {
	cambiaStatoOfferta,
	eliminaOfferta,
} from "@/app/(back-office)/offerte/actions";

const MESSAGGIO_BLOCCO_ELIMINAZIONE =
	"Impossibile eliminare l'offerta: esistono righe attività collegate. Disattiva l'offerta invece di eliminarla.";

describe("cambiaStatoOfferta", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRichiediRuoloApi.mockResolvedValue(undefined);
		mockOfferta.update.mockResolvedValue(undefined);
	});

	// (a) toggle aggiorna `attiva` e rivalida/redirige
	it("disattiva l'offerta, rivalida /offerte e redirige con esito", async () => {
		const formData = new FormData();
		formData.set("id", "off-1");
		formData.set("attiva", "false");

		await cambiaStatoOfferta(formData);

		expect(mockOfferta.update).toHaveBeenCalledWith({
			where: { id: "off-1" },
			data: { attiva: false },
		});
		expect(mockRevalidatePath).toHaveBeenCalledWith("/offerte");
		expect(mockRedirect).toHaveBeenCalledWith(
			"/offerte?esito=stato-offerta-aggiornato",
		);
	});

	it("riattiva l'offerta quando attiva vale 'true'", async () => {
		const formData = new FormData();
		formData.set("id", "off-1");
		formData.set("attiva", "true");

		await cambiaStatoOfferta(formData);

		expect(mockOfferta.update).toHaveBeenCalledWith({
			where: { id: "off-1" },
			data: { attiva: true },
		});
	});

	it("con id mancante redirige a /offerte senza aggiornare", async () => {
		// In produzione redirect interrompe l'esecuzione lanciando; lo simuliamo
		// per verificare la guardia sull'id mancante prima dell'update.
		mockRedirect.mockImplementationOnce(() => {
			throw new Error("NEXT_REDIRECT");
		});

		const formData = new FormData();
		formData.set("attiva", "true");

		await expect(cambiaStatoOfferta(formData)).rejects.toThrow(
			"NEXT_REDIRECT",
		);

		expect(mockRedirect).toHaveBeenCalledWith("/offerte");
		expect(mockOfferta.update).not.toHaveBeenCalled();
	});

	// (e) guardia di ruolo
	it("applica la guardia AMMINISTRATORE prima di aggiornare", async () => {
		mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

		const formData = new FormData();
		formData.set("id", "off-1");
		formData.set("attiva", "false");

		await expect(cambiaStatoOfferta(formData)).rejects.toThrow(
			"Accesso negato",
		);
		expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
		expect(mockOfferta.update).not.toHaveBeenCalled();
	});
});

describe("eliminaOfferta", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRichiediRuoloApi.mockResolvedValue(undefined);
		mockRigaAttivita.count.mockResolvedValue(0);
		mockOfferta.delete.mockResolvedValue(undefined);
	});

	// (b) eliminazione bloccata quando ci sono righe collegate
	it("blocca l'eliminazione quando esistono righe attività collegate", async () => {
		mockRigaAttivita.count.mockResolvedValue(3);

		const formData = new FormData();
		formData.set("id", "off-1");

		const result = await eliminaOfferta({}, formData);

		expect(mockRigaAttivita.count).toHaveBeenCalledWith({
			where: { offertaId: "off-1" },
		});
		expect(result.errore).toBe(MESSAGGIO_BLOCCO_ELIMINAZIONE);
		expect(mockOfferta.delete).not.toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	// (c) eliminazione riuscita
	it("elimina l'offerta senza righe, rivalida i path e redirige", async () => {
		const formData = new FormData();
		formData.set("id", "off-1");

		await eliminaOfferta({}, formData);

		expect(mockOfferta.delete).toHaveBeenCalledWith({
			where: { id: "off-1" },
		});
		expect(mockRevalidatePath).toHaveBeenCalledWith("/offerte");
		expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/clienti");
		expect(mockRedirect).toHaveBeenCalledWith(
			"/offerte?esito=offerta-eliminata",
		);
	});

	// (d) errore P2003 tradotto nel messaggio di blocco
	it("traduce l'errore Prisma P2003 nel messaggio di blocco", async () => {
		const errore = new Error("foreign key") as Error & { code: string };
		errore.code = "P2003";
		mockOfferta.delete.mockRejectedValue(errore);

		const formData = new FormData();
		formData.set("id", "off-1");

		const result = await eliminaOfferta({}, formData);

		expect(result.errore).toBe(MESSAGGIO_BLOCCO_ELIMINAZIONE);
		expect(mockRevalidatePath).not.toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it("rilancia gli errori non P2003 dal delete", async () => {
		const errore = new Error("boom") as Error & { code: string };
		errore.code = "P9999";
		mockOfferta.delete.mockRejectedValue(errore);

		const formData = new FormData();
		formData.set("id", "off-1");

		await expect(eliminaOfferta({}, formData)).rejects.toThrow("boom");
	});

	it("con id mancante restituisce errore e non conta né elimina", async () => {
		const formData = new FormData();

		const result = await eliminaOfferta({}, formData);

		expect(result.errore).toBe("ID offerta mancante");
		expect(mockRigaAttivita.count).not.toHaveBeenCalled();
		expect(mockOfferta.delete).not.toHaveBeenCalled();
	});

	// (e) guardia di ruolo
	it("applica la guardia AMMINISTRATORE prima di qualsiasi accesso a DB", async () => {
		mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

		const formData = new FormData();
		formData.set("id", "off-1");

		await expect(eliminaOfferta({}, formData)).rejects.toThrow(
			"Accesso negato",
		);
		expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
		expect(mockRigaAttivita.count).not.toHaveBeenCalled();
		expect(mockOfferta.delete).not.toHaveBeenCalled();
	});
});
