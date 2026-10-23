// Adattatore nullo T1: la baseline non ha il referente. Ogni operazione che lo richiede è
// NonImplementato; nessuna capacità viene simulata. Il report di fatturazione esiste nella
// baseline, ma P3 dipende dall'aggiornamento del referente e resta comunque non superabile.
import { NonImplementato, type AdattatoreIntegrazione } from "../contratto";

const assente = async (): Promise<never> => {
	throw new NonImplementato("baseline: referente del cliente assente");
};

export const adattatoreIntegrazione: AdattatoreIntegrazione = {
	creaCliente: assente,
	aggiornaReferente: assente,
	referentePersistito: assente,
	clientePerDettaglio: assente,
	importiFatturazioneCliente: assente,
	ruoloUtenteCliente: null,
};
