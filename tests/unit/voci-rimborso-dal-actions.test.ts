import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVoceRimborsoTrasferta = vi.hoisted(() => ({
	findMany: vi.fn(),
	findUnique: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: { voceRimborsoTrasferta: mockVoceRimborsoTrasferta },
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

const { mockValidaVoceRimborso } = vi.hoisted(() => ({
	mockValidaVoceRimborso: vi.fn(),
}));

vi.mock("@/domain/anagrafiche/valida-voce-rimborso", () => ({
	validaVoceRimborso: mockValidaVoceRimborso,
}));

const { mockNormalizzaTariffa } = vi.hoisted(() => ({
	mockNormalizzaTariffa: vi.fn(),
}));

vi.mock("@/domain/anagrafiche/valida-offerta", () => ({
	normalizzaTariffaGiornaliera: mockNormalizzaTariffa,
}));

import { elencaVociRimborso, vocePerId } from "@/lib/voci-rimborso";
import {
	creaVoceRimborso,
	aggiornaVoceRimborso,
	eliminaVoceRimborso,
} from "@/app/(back-office)/anagrafiche/voci-rimborso/actions";

describe("DAL voci di rimborso trasferta", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRichiediRuoloApi.mockResolvedValue(undefined);
	});

	it("elenca le voci di rimborso in ordine di creazione", async () => {
		const vociRimborso = [
			{
				id: "vrt-1",
				etichetta: "Rimborso trasferta breve",
				importo: "28.00",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				id: "vrt-2",
				etichetta: "Rimborso trasferta lunga",
				importo: "50.00",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		];
		mockVoceRimborsoTrasferta.findMany.mockResolvedValue(vociRimborso);

		const result = await elencaVociRimborso();

		expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
		expect(mockVoceRimborsoTrasferta.findMany).toHaveBeenCalledWith({
			orderBy: { createdAt: "asc" },
		});
		expect(result).toEqual(vociRimborso);
	});

	it("restituisce una voce di rimborso per id", async () => {
		const voce = {
			id: "vrt-1",
			etichetta: "Rimborso trasferta breve",
			importo: "28.00",
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		mockVoceRimborsoTrasferta.findUnique.mockResolvedValue(voce);

		const result = await vocePerId("vrt-1");

		expect(mockVoceRimborsoTrasferta.findUnique).toHaveBeenCalledWith({
			where: { id: "vrt-1" },
		});
		expect(result).toEqual(voce);
	});
});

describe("Server Actions voci di rimborso trasferta", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRichiediRuoloApi.mockResolvedValue(undefined);
		mockValidaVoceRimborso.mockReturnValue({});
		mockNormalizzaTariffa.mockReturnValue({
			valore: "28.00",
			centesimi: BigInt(2800),
		});
		mockVoceRimborsoTrasferta.findMany.mockResolvedValue([]);
		mockVoceRimborsoTrasferta.create.mockResolvedValue(undefined);
		mockVoceRimborsoTrasferta.update.mockResolvedValue(undefined);
		mockVoceRimborsoTrasferta.delete.mockResolvedValue(undefined);
	});

	it("con dati invalidi non scrive a DB e restituisce la mappa errori", async () => {
		mockValidaVoceRimborso.mockReturnValue({
			etichetta: "L'etichetta è obbligatoria",
		});

		const formData = new FormData();
		formData.set("etichetta", "");
		formData.set("importo", "28,00");

		const result = await creaVoceRimborso({ errori: {} }, formData);

		expect(result.errori.etichetta).toBe("L'etichetta è obbligatoria");
		expect(mockVoceRimborsoTrasferta.create).not.toHaveBeenCalled();
	});

	it("crea la voce di rimborso con etichetta e importo e rivalida i path", async () => {
		const formData = new FormData();
		formData.set("etichetta", "Rimborso trasferta breve");
		formData.set("importo", "28,00");

		await creaVoceRimborso({ errori: {} }, formData);

		expect(mockVoceRimborsoTrasferta.create).toHaveBeenCalledWith({
			data: { etichetta: "Rimborso trasferta breve", importo: "28.00" },
		});
		expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/voci-rimborso");
		expect(mockRedirect).toHaveBeenCalledWith(
			"/anagrafiche/voci-rimborso?esito=creato",
		);
	});

	it("crea due voci con la stessa etichetta senza alcun controllo di unicità", async () => {
		const formData = new FormData();
		formData.set("etichetta", "Rimborso trasferta breve");
		formData.set("importo", "28,00");

		await creaVoceRimborso({ errori: {} }, formData);
		await creaVoceRimborso({ errori: {} }, formData);

		expect(mockVoceRimborsoTrasferta.create).toHaveBeenCalledTimes(2);
		expect(mockVoceRimborsoTrasferta.findMany).not.toHaveBeenCalled();
	});

	it("aggiorna la voce di rimborso con etichetta e importo", async () => {
		const formData = new FormData();
		formData.set("id", "vrt-1");
		formData.set("etichetta", "Rimborso trasferta lunga");
		formData.set("importo", "30,00");

		await aggiornaVoceRimborso({ errori: {} }, formData);

		expect(mockVoceRimborsoTrasferta.update).toHaveBeenCalledWith({
			where: { id: "vrt-1" },
			data: { etichetta: "Rimborso trasferta lunga", importo: "28.00" },
		});
		expect(mockRedirect).toHaveBeenCalledWith(
			"/anagrafiche/voci-rimborso?esito=salvato",
		);
	});

	it("rifiuta l'aggiornamento senza id senza scrivere a DB", async () => {
		const formData = new FormData();
		formData.set("etichetta", "Rimborso trasferta lunga");
		formData.set("importo", "30,00");

		const result = await aggiornaVoceRimborso({ errori: {} }, formData);

		expect(result.errori._form).toBe("ID voce di rimborso mancante");
		expect(mockVoceRimborsoTrasferta.update).not.toHaveBeenCalled();
	});

	it("elimina la voce senza verifiche preventive e rivalida i path", async () => {
		const formData = new FormData();
		formData.set("id", "vrt-1");

		await eliminaVoceRimborso(formData);

		expect(mockVoceRimborsoTrasferta.findMany).not.toHaveBeenCalled();
		expect(mockVoceRimborsoTrasferta.findUnique).not.toHaveBeenCalled();
		expect(mockVoceRimborsoTrasferta.delete).toHaveBeenCalledWith({
			where: { id: "vrt-1" },
		});
		expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/voci-rimborso");
		expect(mockRedirect).toHaveBeenCalledWith(
			"/anagrafiche/voci-rimborso?esito=eliminato",
		);
	});

	it("applica la guardia di ruolo su DAL e Server Actions", async () => {
		mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

		await expect(elencaVociRimborso()).rejects.toThrow("Accesso negato");
		await expect(vocePerId("vrt-1")).rejects.toThrow("Accesso negato");

		const formData = new FormData();
		formData.set("etichetta", "Rimborso trasferta breve");
		formData.set("importo", "28,00");

		await expect(creaVoceRimborso({ errori: {} }, formData)).rejects.toThrow(
			"Accesso negato",
		);
		expect(mockVoceRimborsoTrasferta.create).not.toHaveBeenCalled();

		const formDataElimina = new FormData();
		formDataElimina.set("id", "vrt-1");
		await expect(eliminaVoceRimborso(formDataElimina)).rejects.toThrow(
			"Accesso negato",
		);
		expect(mockVoceRimborsoTrasferta.delete).not.toHaveBeenCalled();
	});
});
