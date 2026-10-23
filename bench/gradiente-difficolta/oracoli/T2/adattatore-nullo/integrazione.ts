// Adattatore nullo T2: la baseline non ha il report di marginalità (il PRD lo rinvia).
// Nessuna capacità simulata; il report fatturazione esiste ma P2 dipende dalla marginalità.
import { NonImplementato, type AdattatoreIntegrazione } from "../contratto";

const assente = async (): Promise<never> => {
	throw new NonImplementato("baseline: report di marginalità assente");
};

export const adattatoreIntegrazione: AdattatoreIntegrazione = {
	reportMarginalita: assente,
	scalaPercentuale: "punti",
	importiFatturazioneCliente: assente,
	ruoloUtenteCliente: null,
};
