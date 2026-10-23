// Adattatore della baseline T4: tutte le capacità esistono, quindi questo file NON dichiara
// NonImplementato ma collega le funzioni reali della baseline (anche quella col difetto).
// La mappatura (solo rinomina dei campi e Number(...)) è in shared/proiezioni-baseline.ts ed è il
// riferimento per gli adattatori delle consegne.
import { proiezioniBaseline } from "../shared/proiezioni-baseline";
import type { AdattatoreIntegrazione } from "../contratto";

export const adattatoreIntegrazione: AdattatoreIntegrazione = {
	riepilogoMese: (token) => proiezioniBaseline.riepilogoMese(token),
	avanzamentoOfferta: (offertaId, clienteId) => proiezioniBaseline.avanzamentoOfferta(offertaId, clienteId),
	importiFatturazioneCliente: (token, clienteId) => proiezioniBaseline.importiFatturazioneCliente(token, clienteId),
};
