// Adattatore nullo T3 · browser: nessuna gestione tariffe nella baseline. I form esistenti ci
// sono, ma S1/S2 dipendono dalla lettura delle validità (adattatoreDati), assente.
import { NonImplementato, type AdattatoreBrowser } from "../contratto";

const assente = (): never => {
	throw new NonImplementato("baseline: tariffe con validità nel tempo assenti");
};

export const adattatoreBrowser: AdattatoreBrowser = {
	creaOffertaDaForm: async () => assente(),
	modificaDescrizioneOffertaDaForm: async () => assente(),
	modificaCognomeCollaboratoreDaForm: async () => assente(),
	pianificaTariffaDaInterfaccia: async () => assente(),
	percorsiGestioneTariffe: () => assente(),
	elencoValidita: () => assente(),
	percorsoReportFatturazione: () => assente(),
	schedaClienteReport: () => assente(),
	percorsoAvanzamento: () => assente(),
};
