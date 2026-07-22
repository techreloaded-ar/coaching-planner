/**
 * Test per lo script di backfill una tantum delle abilitazioni offerta iniziali (US-042)
 *
 * Verifica, sul confine di persistenza (client `ClientBackfillAbilitazioni`
 * iniettato con metodi `vi.fn()`), il comportamento a supporto di AC-4:
 * - tabella abilitazioni vuota con attività note: si leggono le coppie
 *   collaboratore/offerta distinte sulle offerte attive e si inseriscono
 *   esattamente quelle, con esito "popolato"
 * - tabella già popolata: il backfill una tantum non legge né scrive nulla
 *   (esito "gia-popolato"), così da non ricreare abilitazioni revocate
 * - nessuna attività su offerte attive: nessuna scrittura, esito
 *   "nessuna-attivita"
 */

import { describe, it, expect, vi } from "vitest";
import {
	eseguiBackfillAbilitazioniIniziali,
	type ClientBackfillAbilitazioni,
} from "@/../scripts/backfill-abilitazioni-iniziali";

// ── Client finto ──────────────────────────────────────────────────

function creaClientFinto(): ClientBackfillAbilitazioni {
	return {
		abilitazioneOfferta: {
			count: vi.fn(),
			createMany: vi.fn(),
		},
		rigaAttivita: {
			findMany: vi.fn(),
		},
	};
}

// ── AC-4: tabella vuota con attività registrate ───────────────────

describe("eseguiBackfillAbilitazioniIniziali — tabella vuota con attività (AC-4)", () => {
	it("legge le coppie distinte sulle offerte attive e inserisce esattamente quelle, con esito popolato", async () => {
		const client = creaClientFinto();
		const coppie = [
			{ collaboratoreId: "collab-1", offertaId: "offerta-1" },
			{ collaboratoreId: "collab-1", offertaId: "offerta-2" },
			{ collaboratoreId: "collab-2", offertaId: "offerta-1" },
		];
		vi.mocked(client.abilitazioneOfferta.count).mockResolvedValue(0);
		vi.mocked(client.rigaAttivita.findMany).mockResolvedValue(coppie);
		vi.mocked(client.abilitazioneOfferta.createMany).mockResolvedValue({
			count: coppie.length,
		});

		const risultato = await eseguiBackfillAbilitazioniIniziali(client);

		expect(client.rigaAttivita.findMany).toHaveBeenCalledTimes(1);
		expect(client.rigaAttivita.findMany).toHaveBeenCalledWith({
			where: { offerta: { attiva: true } },
			select: { collaboratoreId: true, offertaId: true },
			distinct: ["collaboratoreId", "offertaId"],
		});

		expect(client.abilitazioneOfferta.createMany).toHaveBeenCalledTimes(1);
		expect(client.abilitazioneOfferta.createMany).toHaveBeenCalledWith({
			data: coppie,
		});

		expect(risultato).toEqual({ esito: "popolato", inserite: coppie.length });
	});
});

// ── Idempotenza: tabella già popolata ─────────────────────────────

describe("eseguiBackfillAbilitazioniIniziali — tabella già popolata (una tantum)", () => {
	it("non legge le attività né scrive abilitazioni e restituisce gia-popolato", async () => {
		const client = creaClientFinto();
		vi.mocked(client.abilitazioneOfferta.count).mockResolvedValue(3);

		const risultato = await eseguiBackfillAbilitazioniIniziali(client);

		expect(client.abilitazioneOfferta.count).toHaveBeenCalledTimes(1);
		expect(client.rigaAttivita.findMany).not.toHaveBeenCalled();
		expect(client.abilitazioneOfferta.createMany).not.toHaveBeenCalled();
		expect(risultato).toEqual({ esito: "gia-popolato", inserite: 0 });
	});
});

// ── Nessuna attività su offerte attive ────────────────────────────

describe("eseguiBackfillAbilitazioniIniziali — nessuna attività su offerte attive", () => {
	it("non scrive nulla e restituisce nessuna-attivita quando non ci sono coppie", async () => {
		const client = creaClientFinto();
		vi.mocked(client.abilitazioneOfferta.count).mockResolvedValue(0);
		vi.mocked(client.rigaAttivita.findMany).mockResolvedValue([]);

		const risultato = await eseguiBackfillAbilitazioniIniziali(client);

		expect(client.rigaAttivita.findMany).toHaveBeenCalledTimes(1);
		expect(client.abilitazioneOfferta.createMany).not.toHaveBeenCalled();
		expect(risultato).toEqual({ esito: "nessuna-attivita", inserite: 0 });
	});
});
