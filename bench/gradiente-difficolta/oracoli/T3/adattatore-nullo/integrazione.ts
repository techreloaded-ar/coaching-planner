// Adattatore nullo T3 · integrazione: pianificazione e correzione delle tariffe assenti
// (NonImplementato); le letture esistono nella baseline e sono solo proiettate.
import { proiezioniBaseline } from "../shared/proiezioni-baseline";
import { NonImplementato, type AdattatoreIntegrazione } from "../contratto";

const assente = async (): Promise<never> => {
	throw new NonImplementato("baseline: gestione delle tariffe con decorrenza assente");
};

export const adattatoreIntegrazione: AdattatoreIntegrazione = {
	pianificaTariffa: assente,
	correggiUltimaTariffa: assente,
	riepilogoMese: (token) => proiezioniBaseline.riepilogoMese(token),
	importiFatturazioneCliente: (token, clienteId) => proiezioniBaseline.importiFatturazioneCliente(token, clienteId),
	avanzamentoOfferta: (offertaId, clienteId) => proiezioniBaseline.avanzamentoOfferta(offertaId, clienteId),
};
