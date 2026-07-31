import type {
	Cliente,
	Offerta,
	RigaAttivita,
} from "../../../src/generated/prisma/client";
import { ORE_PER_GIORNATA } from "../../../src/domain/types";

import { dataNelMesePassatoRiservato, mesePassatoRiservato } from "./date";
import type { CollaboratoreTestData, E2eDataFactory } from "./factory";

const CODICE_SPEC_REPORT_FATTURAZIONE_CLIENTI =
	"US-023-TASK-07-REPORT-FATTURAZIONE-CLIENTI";
const CODICE_SPEC_REPORT_FATTURAZIONE_CLIENTI_VUOTO =
	"US-023-TASK-08-REPORT-FATTURAZIONE-CLIENTI-VUOTO";
const EMAIL_REPORT_E2E_DOMAIN = "report-fatturazione.e2e.invalid";

export type TotaliReportFatturazioneAttesi = {
	giornate: number;
	imponibile: string;
	rimborsi: string;
	totale: string;
};

export type OffertaReportFatturazioneAttesa = {
	offertaId: string;
	offertaCodice: string;
	offertaDescrizione: string;
	totali: TotaliReportFatturazioneAttesi;
};

export type ClienteReportFatturazioneAtteso = {
	clienteId: string;
	clienteRagioneSociale: string;
	perOfferta: OffertaReportFatturazioneAttesa[];
	totali: TotaliReportFatturazioneAttesi;
};

export type DatasetReportFatturazioneClienti = {
	codiceSpec: string;
	mese: string;
	cliente: Cliente;
	offerta: Offerta;
	collaboratori: CollaboratoreTestData[];
	righeFatturabili: RigaAttivita[];
	righeNonFatturabili: RigaAttivita[];
	righeTrasferta: RigaAttivita[];
	atteso: {
		perCliente: ClienteReportFatturazioneAtteso[];
		totali: TotaliReportFatturazioneAttesi;
	};
};

export type CreaDatasetReportFatturazioneClientiOptions = {
	codiceSpec?: string;
	mesiIndietro?: number;
	tariffaGiornaliera?: string | number;
};

export function meseVuotoReportFatturazioneClienti(): string {
	return mesePassatoRiservato(CODICE_SPEC_REPORT_FATTURAZIONE_CLIENTI_VUOTO);
}

function hashStabile(value: string): number {
	let hash = 2166136261;

	for (const character of value) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}

	return hash >>> 0;
}

function tokenBreve(value: string): string {
	return hashStabile(value).toString(36);
}

function dataRiservata(codiceSpec: string, giorno: number, mesiIndietro: number) {
	return new Date(
		`${dataNelMesePassatoRiservato(codiceSpec, giorno, mesiIndietro)}T00:00:00.000Z`,
	);
}

function importo(valore: number): string {
	return valore.toFixed(2);
}

/**
 * Crea un dataset isolato per il report fatturazione clienti in un mese passato
 * riservato dal registro date e restituisce i totali attesi già calcolati.
 *
 * I test di report devono aprire la pagina con `?mese=${dataset.mese}` e non
 * devono asserire sul mese corrente globale né su un mese precedente vuoto
 * condiviso: entrambi possono essere alterati da seed o da altri scenari e2e.
 */
export async function creaDatasetReportFatturazioneClienti(
	factory: E2eDataFactory,
	options: CreaDatasetReportFatturazioneClientiOptions = {},
): Promise<DatasetReportFatturazioneClienti> {
	const codiceSpec =
		options.codiceSpec ?? CODICE_SPEC_REPORT_FATTURAZIONE_CLIENTI;
	const mesiIndietro = options.mesiIndietro ?? 1;
	const mese = mesePassatoRiservato(codiceSpec, mesiIndietro);
	const suffisso = tokenBreve(`${factory.namespace}:${codiceSpec}:${mesiIndietro}`);
	const tariffaGiornaliera = options.tariffaGiornaliera ?? "640.00";
	const tariffa = Number(tariffaGiornaliera);
	const importoTrasfertaFatturabile = 35;
	const importoTrasfertaNonFatturabile = 22.5;

	const cliente = await factory.createCliente({
		ragioneSociale: `E2E Report fatturazione ${suffisso}`,
	});
	const offerta = await factory.createOfferta({
		cliente,
		codice: `RPT-${suffisso}`,
		descrizione: `Offerta report fatturazione ${suffisso}`,
		tariffaGiornaliera,
	});
	const collaboratori = [
		await factory.createCollaboratore({
			nome: "E2E Report",
			cognome: `Fatturabile ${suffisso}`,
			utenteOptions: {
				email: `fatturabile-${suffisso}@${EMAIL_REPORT_E2E_DOMAIN}`,
			},
		}),
		await factory.createCollaboratore({
			nome: "E2E Report",
			cognome: `Trasferta ${suffisso}`,
			utenteOptions: {
				email: `trasferta-${suffisso}@${EMAIL_REPORT_E2E_DOMAIN}`,
			},
		}),
	];

	const rigaFatturabileIntera = await factory.createRigaAttivita({
		collaboratore: collaboratori[0],
		cliente,
		offerta,
		data: dataRiservata(codiceSpec, 4, mesiIndietro),
		ore: "8.00",
		nota: `Report fatturabile intera ${suffisso}`,
		fatturabile: true,
	});
	const rigaFatturabileTrasferta = await factory.createRigaAttivita({
		collaboratore: collaboratori[1],
		cliente,
		offerta,
		data: dataRiservata(codiceSpec, 11, mesiIndietro),
		ore: "4.00",
		nota: `Report fatturabile trasferta ${suffisso}`,
		fatturabile: true,
		rimborsoTrasfertaEtichetta: `Trasferta fatturabile ${suffisso}`,
		rimborsoTrasfertaImporto: importo(importoTrasfertaFatturabile),
	});
	const rigaNonFatturabileTrasferta = await factory.createRigaAttivita({
		collaboratore: collaboratori[1],
		cliente,
		offerta,
		data: dataRiservata(codiceSpec, 18, mesiIndietro),
		ore: "6.00",
		nota: `Report non fatturabile trasferta ${suffisso}`,
		fatturabile: false,
		rimborsoTrasfertaEtichetta: `Trasferta non fatturabile ${suffisso}`,
		rimborsoTrasfertaImporto: importo(importoTrasfertaNonFatturabile),
	});

	const righeFatturabili = [rigaFatturabileIntera, rigaFatturabileTrasferta];
	const righeNonFatturabili = [rigaNonFatturabileTrasferta];
	const righeTrasferta = [
		rigaFatturabileTrasferta,
		rigaNonFatturabileTrasferta,
	];
	const oreFatturabili = 12;
	const giornate = oreFatturabili / ORE_PER_GIORNATA;
	const rimborsi = importoTrasfertaFatturabile + importoTrasfertaNonFatturabile;
	const imponibile = giornate * tariffa;
	const totale = imponibile + rimborsi;
	const totali = {
		giornate,
		imponibile: importo(imponibile),
		rimborsi: importo(rimborsi),
		totale: importo(totale),
	};

	return {
		codiceSpec,
		mese,
		cliente,
		offerta,
		collaboratori,
		righeFatturabili,
		righeNonFatturabili,
		righeTrasferta,
		atteso: {
			perCliente: [
				{
					clienteId: cliente.id,
					clienteRagioneSociale: cliente.ragioneSociale,
					perOfferta: [
						{
							offertaId: offerta.id,
							offertaCodice: offerta.codice,
							offertaDescrizione: offerta.descrizione,
							totali,
						},
					],
					totali,
				},
			],
			totali,
		},
	};
}
