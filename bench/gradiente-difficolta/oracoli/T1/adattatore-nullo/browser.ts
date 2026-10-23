// Adattatore nullo T1: la baseline non mostra né modifica il referente.
import { NonImplementato, type AdattatoreBrowser } from "../contratto";

const assente = (): never => {
	throw new NonImplementato("baseline: referente del cliente assente");
};

export const adattatoreBrowser: AdattatoreBrowser = {
	impostaReferente: async () => assente(),
	percorsoElencoClienti: () => assente(),
	percorsoDettaglioCliente: () => assente(),
	percorsoModificaReferente: () => assente(),
	percorsoReportFatturazione: () => assente(),
	voceClienteInElenco: () => assente(),
	intestazioneClienteReport: () => assente(),
	campiReferente: () => assente(),
	salvaForm: async () => assente(),
	erroreEmailReferente: () => assente(),
	controlliModificaReferente: () => assente(),
};
