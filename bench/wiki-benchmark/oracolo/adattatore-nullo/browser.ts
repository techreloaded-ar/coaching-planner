// Adattatore della baseline: la funzionalità non esiste, ogni operazione è NonImplementato.
import { NonImplementato, type AdattatoreBrowser } from "../contratto";

const assente = (): never => {
	throw new NonImplementato("baseline: chiusura del mese assente");
};

export const adattatoreBrowser: AdattatoreBrowser = {
	chiudiMese: async () => assente(),
	riapriMese: async () => assente(),
	indicatoreMeseChiuso: () => assente(),
	azioniModificaGiornata: () => assente(),
	statoMeseNelReport: async () => assente(),
	compilaNuovaRiga: async () => assente(),
	inviaNuovaRiga: async () => assente(),
	messaggioErrore: () => assente(),
	pagineFunzionalita: () => [],
};
