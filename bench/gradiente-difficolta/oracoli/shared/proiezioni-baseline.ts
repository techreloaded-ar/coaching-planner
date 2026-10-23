/**
 * Proiezioni delle funzioni REALI della baseline sui tipi comuni (solo rinomina dei campi e
 * Number(...), nessun calcolo). Usate dagli adattatori della baseline (T3, T4) e dalla fase
 * «prima» della migrazione, che gira sul worktree della baseline.
 */
import { riepilogoMese } from "@/lib/attivita";
import { elencaOffertePerClienteConAvanzamento } from "@/lib/offerte";
import { reportFatturazioneClientiMese } from "@/lib/report";
import type {
	AvanzamentoOfferta,
	ImportiClienteFatturazione,
	RiepilogoMeseCollaboratore,
	TokenMese,
} from "./contratto-comune";

export const proiezioniBaseline = {
	async riepilogoMese(token: TokenMese): Promise<RiepilogoMeseCollaboratore> {
		const r = await riepilogoMese(token);
		return {
			oreTotali: r.totali.oreTotali,
			oreFatturabili: r.totali.oreFatturabili,
			giornateTotali: r.totali.giornateTotali,
			giornateFatturabili: r.totali.giornateFatturabili,
			imponibileManodopera: Number(r.breakdown.imponibileManodopera),
			totaleRimborsi: Number(r.totali.totaleRimborsi),
			importoFattura: Number(r.importoFattura),
			perOfferta: r.perOfferta.map((v) => ({
				offertaId: v.offertaId,
				oreTotali: v.oreTotali,
				oreFatturabili: v.oreFatturabili,
				giornateTotali: v.giornateTotali,
				giornateFatturabili: v.giornateFatturabili,
				rimborsiTrasferta: Number(v.rimborsiTrasferta),
			})),
		};
	},

	async avanzamentoOfferta(offertaId: string, clienteId: string): Promise<AvanzamentoOfferta | null> {
		const voce = (await elencaOffertePerClienteConAvanzamento(clienteId)).find((v) => v.offertaId === offertaId);
		if (!voce) return null;
		return {
			offertaId: voce.offertaId,
			giornatePreviste: voce.giorniPrevisti,
			giornateErogate: voce.giornateErogate,
			residuo: voce.residuo,
			percentualeUtilizzo: voce.percentualeUtilizzo,
			perCollaboratore: voce.perCollaboratore.map((c) => ({
				collaboratoreId: c.collaboratoreId,
				oreErogate: c.oreErogate,
				giornateErogate: c.giornateErogate,
			})),
			matrice: {
				mesi: voce.matriceMensile.mesi,
				righe: voce.matriceMensile.righe.map((r) => ({
					collaboratoreId: r.collaboratoreId,
					giornatePerMese: r.giornatePerMese,
					totaleGiornate: r.totaleGiornate,
				})),
				totaliPerMese: voce.matriceMensile.totaliPerMese,
				totaleGiornate: voce.matriceMensile.totaleGiornate,
			},
		};
	},

	async importiFatturazioneCliente(token: TokenMese, clienteId: string): Promise<ImportiClienteFatturazione | null> {
		const cliente = (await reportFatturazioneClientiMese(token)).perCliente.find((c) => c.clienteId === clienteId);
		if (!cliente) return null;
		return {
			clienteId: cliente.clienteId,
			imponibileManodopera: Number(cliente.imponibileManodopera),
			rimborsiTrasferta: Number(cliente.rimborsiTrasferta),
			importoTotale: Number(cliente.importoTotale),
			perOfferta: cliente.perOfferta.map((o) => ({
				offertaId: o.offertaId,
				giornateFatturabili: o.giornateFatturabili,
				imponibile: Number(o.imponibile),
			})),
		};
	},
};
