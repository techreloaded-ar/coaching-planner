// Adattatore della baseline: la funzionalità non esiste, ogni operazione è NonImplementato.
import { NonImplementato, type AdattatoreIntegrazione } from "../contratto";

const assente = async (): Promise<never> => {
	throw new NonImplementato("baseline: chiusura del mese assente");
};

export const adattatoreIntegrazione: AdattatoreIntegrazione = {
	chiudiMese: assente,
	riapriMese: assente,
	meseChiuso: assente,
	storico: assente,
};
