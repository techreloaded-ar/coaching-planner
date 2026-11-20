import { describe, it, expect } from "vitest";
import {
	centesimiDaTesto,
	centesimiInCampo,
	centesimiInDecimale,
	giorniDaTesto,
	importoTotaleCentesimi,
	tariffaACorpoCentesimi,
} from "@/domain/anagrafiche/prezzo-offerta";

describe("prezzo offerta — lettura dei valori digitati", () => {
	it("legge importi con virgola o punto e al massimo due decimali", () => {
		expect(centesimiDaTesto("650")).toBe(BigInt(65000));
		expect(centesimiDaTesto("650,5")).toBe(BigInt(65050));
		expect(centesimiDaTesto(" 10000.00 ")).toBe(BigInt(1000000));
		expect(centesimiDaTesto("")).toBeNull();
		expect(centesimiDaTesto("650,555")).toBeNull();
		expect(centesimiDaTesto("10.000,00")).toBeNull();
	});

	it("accetta solo giorni interi positivi", () => {
		expect(giorniDaTesto("15")).toBe(15);
		expect(giorniDaTesto("0")).toBeNull();
		expect(giorniDaTesto("1,5")).toBeNull();
		expect(giorniDaTesto("")).toBeNull();
	});
});

describe("prezzo offerta — calcoli", () => {
	it("a giornata: importo totale = tariffa × giorni", () => {
		expect(importoTotaleCentesimi(BigInt(65000), 15)).toBe(BigInt(975000));
	});

	it("a corpo: tariffa = importo ÷ giorni arrotondata al centesimo", () => {
		// 10.000,00 € ÷ 15 = 666,666… → 666,67 €
		expect(tariffaACorpoCentesimi(BigInt(1000000), 15)).toBe(BigInt(66667));
		// 9.750,00 € ÷ 15 = 650,00 € esatti
		expect(tariffaACorpoCentesimi(BigInt(975000), 15)).toBe(BigInt(65000));
		// 1.000,00 € ÷ 3 = 333,333… → 333,33 € (per difetto sotto la metà)
		expect(tariffaACorpoCentesimi(BigInt(100000), 3)).toBe(BigInt(33333));
		// 0,05 € ÷ 2 = 0,025 → 0,03 € (la metà va per eccesso)
		expect(tariffaACorpoCentesimi(BigInt(5), 2)).toBe(BigInt(3));
	});

	it("formatta i centesimi per il database e per il form", () => {
		expect(centesimiInDecimale(BigInt(66667))).toBe("666.67");
		expect(centesimiInDecimale(BigInt(5))).toBe("0.05");
		expect(centesimiInCampo(BigInt(1000000))).toBe("10000,00");
	});
});
