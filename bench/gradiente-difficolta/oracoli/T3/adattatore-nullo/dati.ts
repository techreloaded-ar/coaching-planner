// Adattatore nullo T3 · dati: la baseline ha una sola tariffa corrente per entità e non può
// rappresentare validità nel tempo. Nessuna storia viene simulata.
import { NonImplementato, type AdattatoreDati } from "../contratto";

const assente = async (): Promise<never> => {
	throw new NonImplementato("baseline: tariffe con validità nel tempo assenti");
};

export const adattatoreDati: AdattatoreDati = {
	creaCollaboratore: assente,
	creaOfferta: assente,
	validita: assente,
	semanticaFine: "implicita",
};
