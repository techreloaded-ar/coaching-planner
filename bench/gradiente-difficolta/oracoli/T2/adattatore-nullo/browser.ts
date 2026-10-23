// Adattatore nullo T2: nessuna pagina di marginalità nella baseline.
import { NonImplementato, type AdattatoreBrowser } from "../contratto";

const assente = (): never => {
	throw new NonImplementato("baseline: report di marginalità assente");
};

export const adattatoreBrowser: AdattatoreBrowser = {
	apriReport: async () => assente(),
	impostaPeriodoDaInterfaccia: async () => assente(),
	sezioneCliente: async () => assente(),
	percorsoBackOffice: () => assente(),
	collegamentoAlReport: () => assente(),
	contenitoreReport: () => assente(),
};
