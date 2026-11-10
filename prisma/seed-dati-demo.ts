/**
 * Dati dimostrativi aggiuntivi per le prove in locale (anteprima).
 *
 * Uso:
 *   npm run db:seed:demo                             (seed di base + dati demo)
 *   sh scripts/archetipo/ambiente.sh rigenera-database   (database del checkout)
 *
 * Si aggiunge al seed di base (prisma/seed.ts) senza modificarlo: quello resta
 * la baseline di e2e e CI, che questo script non lo eseguono mai. Qui vivono
 * invece le casistiche utili a provare l'applicazione a mano: più mesi di
 * attività, offerte attive e disattivate, abilitazioni presenti e mancanti,
 * tutte le modalità di tariffa.
 *
 * I dati sono deterministici e relativi al mese corrente: rieseguendo lo
 * script su un database appena ricreato si ottiene sempre la stessa
 * situazione, "viva" rispetto alla data di oggi.
 *
 * Casistiche coperte (chi guardare):
 *   - Giulia Conti    attività su 5 mesi passati; offerta non abilitata
 *                     (TS-FORF-02), offerta disattivata (DF-STORICO-01),
 *                     affiancamento, non fatturabile e investimento
 *   - Marco Bianchi   cambio di offerta nel tempo, trasferte forfettarie
 *   - Elena Ferri     cambio tariffa, ore senza offerta, mese prossimo pianificato
 *   - Luca Moretti    tariffa PERCENTUALE, ore su offerta disattivata non abilitata
 *   - Sara Galli      tariffa FISSO_MENSILE, un mese lavorato senza tariffa,
 *                     un mese pagato senza attività, nessuna partita IVA
 *   - Paolo Riva      collaboratore non attivo con tariffa chiusa
 *   - Chiara Neri     appena creata: nessuna tariffa, abilitazione o attività
 *   - Offerte         OB-COACH-02 oltre i giorni previsti, OB-DEFINIRE-03 senza
 *                     tariffa, LE-PILOTA-01 senza abilitati né attività
 *   - Clienti         Studio Aurora senza offerte (stato "nuovo")
 */

import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnvConfig(process.cwd());

const RAGIONE_SOCIALE_CLIENTE_MARCATORE = "Nordica Assicurazioni SpA";
const MILLISECONDI_IN_UN_GIORNO = 86_400_000;

const LUNEDI = 1;
const MARTEDI = 2;
const MERCOLEDI = 3;
const GIOVEDI = 4;
const VENERDI = 5;

/** Primo giorno (UTC) del mese distante `mesiIndietro` da oggi; negativo = futuro. */
function primoGiornoDelMeseRelativo(mesiIndietro: number): Date {
	const oggi = new Date();
	return new Date(
		Date.UTC(oggi.getFullYear(), oggi.getMonth() - mesiIndietro, 1),
	);
}

/** Mese in formato YYYY-MM, come nelle decorrenze delle tariffe. */
function chiaveMeseRelativo(mesiIndietro: number): string {
	return primoGiornoDelMeseRelativo(mesiIndietro).toISOString().slice(0, 7);
}

// ponytail: le festività non sono escluse, contano solo i giorni della
// settimana; aggiungere un calendario festivi se le prove lo richiedono.
function dateDelMeseNeiGiorniDellaSettimana(
	mesiIndietro: number,
	giorniDellaSettimana: number[],
): Date[] {
	const primoGiorno = primoGiornoDelMeseRelativo(mesiIndietro);
	const date: Date[] = [];
	for (
		let giorno = primoGiorno;
		giorno.getUTCMonth() === primoGiorno.getUTCMonth();
		giorno = new Date(giorno.getTime() + MILLISECONDI_IN_UN_GIORNO)
	) {
		if (giorniDellaSettimana.includes(giorno.getUTCDay())) {
			date.push(giorno);
		}
	}
	return date;
}

/**
 * Attività che si ripete negli stessi giorni della settimana per un intervallo
 * di mesi (estremi inclusi, espressi come mesi indietro rispetto a oggi).
 */
interface PianoAttivitaRicorrente {
	emailCollaboratore: string;
	ragioneSocialeCliente: string;
	/** null = ore caricate sul cliente con offerta ancora da definire. */
	codiceOfferta: string | null;
	categoria: "FATTURABILE" | "NON_FATTURABILE" | "INVESTIMENTO";
	giorniDellaSettimana: number[];
	daMesiIndietro: number;
	aMesiIndietro: number;
	ore: string;
	nota: string;
	inAffiancamento?: boolean;
	etichettaRimborsoTrasferta?: string;
}

const GIULIA = "giulia.conti@agilereloaded.it";
const MARCO = "marco.bianchi@agilereloaded.it";
const ELENA = "elena.ferri@agilereloaded.it";
const LUCA = "luca.moretti@agilereloaded.it";
const SARA = "sara.galli@agilereloaded.it";
const PAOLO = "paolo.riva@agilereloaded.it";
const CHIARA = "chiara.neri@agilereloaded.it";

const TECHSOLUTIONS = "TechSolutions Srl";
const DATAFLOW = "DataFlow SpA";
const NORDICA = RAGIONE_SOCIALE_CLIENTE_MARCATORE;
const OFFICINE_BRENTA = "Officine Meccaniche Brenta Srl";
const LUMEN = "Lumen Education Srl";
const STUDIO_AURORA = "Studio Aurora";

const RIMBORSO_BREVE = "Rimborso trasferta breve";
const RIMBORSO_MEDIA = "Rimborso trasferta media distanza";
const RIMBORSO_LUNGA = "Rimborso trasferta lunga distanza";

// Giulia e Marco hanno già le attività del mese corrente dal seed di base:
// qui ricevono solo mesi passati, così le giornate non si sovrappongono.
const PIANI_ATTIVITA: PianoAttivitaRicorrente[] = [
	// ── Giulia Conti ──────────────────────────────────────────────
	{ emailCollaboratore: GIULIA, ragioneSocialeCliente: TECHSOLUTIONS, codiceOfferta: "TS-2025-01", categoria: "FATTURABILE", giorniDellaSettimana: [LUNEDI], daMesiIndietro: 5, aMesiIndietro: 1, ore: "8.00", nota: "Workshop architettura in sede", etichettaRimborsoTrasferta: RIMBORSO_BREVE },
	{ emailCollaboratore: GIULIA, ragioneSocialeCliente: TECHSOLUTIONS, codiceOfferta: "TS-2025-01", categoria: "FATTURABILE", giorniDellaSettimana: [MARTEDI], daMesiIndietro: 5, aMesiIndietro: 1, ore: "8.00", nota: "Coaching team piattaforma" },
	{ emailCollaboratore: GIULIA, ragioneSocialeCliente: DATAFLOW, codiceOfferta: "DF-STORICO-01", categoria: "FATTURABILE", giorniDellaSettimana: [MERCOLEDI], daMesiIndietro: 5, aMesiIndietro: 4, ore: "8.00", nota: "Assessment iniziale (offerta poi chiusa)" },
	{ emailCollaboratore: GIULIA, ragioneSocialeCliente: DATAFLOW, codiceOfferta: "DF-2025-02", categoria: "FATTURABILE", giorniDellaSettimana: [MERCOLEDI], daMesiIndietro: 3, aMesiIndietro: 1, ore: "8.00", nota: "Sviluppo dashboard analytics" },
	{ emailCollaboratore: GIULIA, ragioneSocialeCliente: NORDICA, codiceOfferta: "NA-TRASF-01", categoria: "FATTURABILE", giorniDellaSettimana: [GIOVEDI], daMesiIndietro: 5, aMesiIndietro: 3, ore: "8.00", nota: "Affiancamento a Elena sul programma di trasformazione", inAffiancamento: true },
	{ emailCollaboratore: GIULIA, ragioneSocialeCliente: TECHSOLUTIONS, codiceOfferta: "TS-FORF-02", categoria: "FATTURABILE", giorniDellaSettimana: [GIOVEDI], daMesiIndietro: 2, aMesiIndietro: 1, ore: "6.00", nota: "Formazione in sede (abilitazione poi revocata)", etichettaRimborsoTrasferta: RIMBORSO_MEDIA },
	{ emailCollaboratore: GIULIA, ragioneSocialeCliente: TECHSOLUTIONS, codiceOfferta: "TS-2025-01", categoria: "NON_FATTURABILE", giorniDellaSettimana: [GIOVEDI], daMesiIndietro: 2, aMesiIndietro: 1, ore: "2.00", nota: "Preparazione materiali" },
	{ emailCollaboratore: GIULIA, ragioneSocialeCliente: DATAFLOW, codiceOfferta: "DF-2025-02", categoria: "INVESTIMENTO", giorniDellaSettimana: [VENERDI], daMesiIndietro: 5, aMesiIndietro: 1, ore: "4.00", nota: "Studio di fattibilità per estensione" },

	// ── Marco Bianchi ─────────────────────────────────────────────
	{ emailCollaboratore: MARCO, ragioneSocialeCliente: TECHSOLUTIONS, codiceOfferta: "TS-2025-01", categoria: "FATTURABILE", giorniDellaSettimana: [LUNEDI, MARTEDI, MERCOLEDI], daMesiIndietro: 5, aMesiIndietro: 3, ore: "8.00", nota: "Implementazione moduli infrastruttura cloud" },
	{ emailCollaboratore: MARCO, ragioneSocialeCliente: TECHSOLUTIONS, codiceOfferta: "TS-FORF-02", categoria: "FATTURABILE", giorniDellaSettimana: [LUNEDI], daMesiIndietro: 2, aMesiIndietro: 1, ore: "8.00", nota: "Formazione in sede", etichettaRimborsoTrasferta: RIMBORSO_LUNGA },
	{ emailCollaboratore: MARCO, ragioneSocialeCliente: TECHSOLUTIONS, codiceOfferta: "TS-FORF-02", categoria: "FATTURABILE", giorniDellaSettimana: [MARTEDI], daMesiIndietro: 2, aMesiIndietro: 1, ore: "8.00", nota: "Formazione da remoto" },
	{ emailCollaboratore: MARCO, ragioneSocialeCliente: OFFICINE_BRENTA, codiceOfferta: "OB-COACH-02", categoria: "FATTURABILE", giorniDellaSettimana: [MERCOLEDI, GIOVEDI], daMesiIndietro: 2, aMesiIndietro: 1, ore: "8.00", nota: "Coaching reparto produzione" },
	{ emailCollaboratore: MARCO, ragioneSocialeCliente: TECHSOLUTIONS, codiceOfferta: "TS-2025-01", categoria: "NON_FATTURABILE", giorniDellaSettimana: [VENERDI], daMesiIndietro: 5, aMesiIndietro: 1, ore: "4.00", nota: "Allineamento interno e retrospettiva" },

	// ── Elena Ferri (arriva fino al mese prossimo: attività pianificate) ──
	{ emailCollaboratore: ELENA, ragioneSocialeCliente: NORDICA, codiceOfferta: "NA-TRASF-01", categoria: "FATTURABILE", giorniDellaSettimana: [LUNEDI], daMesiIndietro: 5, aMesiIndietro: -1, ore: "8.00", nota: "Programma di trasformazione agile in sede", etichettaRimborsoTrasferta: RIMBORSO_LUNGA },
	{ emailCollaboratore: ELENA, ragioneSocialeCliente: NORDICA, codiceOfferta: "NA-TRASF-01", categoria: "FATTURABILE", giorniDellaSettimana: [MARTEDI, MERCOLEDI], daMesiIndietro: 5, aMesiIndietro: -1, ore: "8.00", nota: "Programma di trasformazione agile" },
	{ emailCollaboratore: ELENA, ragioneSocialeCliente: OFFICINE_BRENTA, codiceOfferta: "OB-COACH-02", categoria: "FATTURABILE", giorniDellaSettimana: [GIOVEDI], daMesiIndietro: 5, aMesiIndietro: 0, ore: "8.00", nota: "Coaching direzione" },
	{ emailCollaboratore: ELENA, ragioneSocialeCliente: OFFICINE_BRENTA, codiceOfferta: "OB-DEFINIRE-03", categoria: "INVESTIMENTO", giorniDellaSettimana: [VENERDI], daMesiIndietro: 3, aMesiIndietro: 2, ore: "4.00", nota: "Prevendita nuova linea di servizio" },
	{ emailCollaboratore: ELENA, ragioneSocialeCliente: STUDIO_AURORA, codiceOfferta: null, categoria: "FATTURABILE", giorniDellaSettimana: [VENERDI], daMesiIndietro: 1, aMesiIndietro: 0, ore: "4.00", nota: "Avvio lavori in attesa dell'offerta" },

	// ── Luca Moretti (tariffa PERCENTUALE) ────────────────────────
	{ emailCollaboratore: LUCA, ragioneSocialeCliente: NORDICA, codiceOfferta: "NA-TRASF-01", categoria: "FATTURABILE", giorniDellaSettimana: [LUNEDI, MARTEDI], daMesiIndietro: 4, aMesiIndietro: 0, ore: "8.00", nota: "Coaching team sinistri" },
	{ emailCollaboratore: LUCA, ragioneSocialeCliente: DATAFLOW, codiceOfferta: "DF-2025-02", categoria: "FATTURABILE", giorniDellaSettimana: [MERCOLEDI], daMesiIndietro: 4, aMesiIndietro: 0, ore: "8.00", nota: "Revisione modello dati" },
	{ emailCollaboratore: LUCA, ragioneSocialeCliente: NORDICA, codiceOfferta: "NA-PILOTA-00", categoria: "FATTURABILE", giorniDellaSettimana: [GIOVEDI], daMesiIndietro: 4, aMesiIndietro: 3, ore: "8.00", nota: "Coda del progetto pilota (offerta chiusa, mai abilitato)" },
	{ emailCollaboratore: LUCA, ragioneSocialeCliente: NORDICA, codiceOfferta: "NA-TRASF-01", categoria: "NON_FATTURABILE", giorniDellaSettimana: [VENERDI], daMesiIndietro: 4, aMesiIndietro: 0, ore: "3.50", nota: "Reportistica di avanzamento" },

	// ── Sara Galli (FISSO_MENSILE; il mese -2 resta volutamente vuoto) ──
	{ emailCollaboratore: SARA, ragioneSocialeCliente: OFFICINE_BRENTA, codiceOfferta: "OB-COACH-02", categoria: "FATTURABILE", giorniDellaSettimana: [MARTEDI, MERCOLEDI, GIOVEDI], daMesiIndietro: 5, aMesiIndietro: 3, ore: "8.00", nota: "Coaching team di linea" },
	{ emailCollaboratore: SARA, ragioneSocialeCliente: OFFICINE_BRENTA, codiceOfferta: "OB-COACH-02", categoria: "FATTURABILE", giorniDellaSettimana: [MARTEDI, MERCOLEDI, GIOVEDI], daMesiIndietro: 1, aMesiIndietro: 0, ore: "8.00", nota: "Coaching team di linea" },
	{ emailCollaboratore: SARA, ragioneSocialeCliente: TECHSOLUTIONS, codiceOfferta: "TS-2025-01", categoria: "NON_FATTURABILE", giorniDellaSettimana: [LUNEDI], daMesiIndietro: 1, aMesiIndietro: 0, ore: "8.00", nota: "Affiancamento per passaggio di consegne", inAffiancamento: true },

	// ── Paolo Riva (non attivo: solo storico) ─────────────────────
	{ emailCollaboratore: PAOLO, ragioneSocialeCliente: NORDICA, codiceOfferta: "NA-PILOTA-00", categoria: "FATTURABILE", giorniDellaSettimana: [LUNEDI, MARTEDI, MERCOLEDI, GIOVEDI], daMesiIndietro: 5, aMesiIndietro: 3, ore: "8.00", nota: "Progetto pilota" },
];

/** Abilitazioni oltre a quelle già create dal backfill del seed di base. */
const ABILITAZIONI_PER_COLLABORATORE: Record<string, string[]> = {
	// Manca apposta TS-FORF-02, su cui Giulia ha attività.
	[GIULIA]: ["NA-TRASF-01", "DF-STORICO-01"],
	[MARCO]: ["TS-FORF-02", "OB-COACH-02"],
	[ELENA]: ["NA-TRASF-01", "OB-COACH-02", "OB-DEFINIRE-03"],
	// Manca apposta NA-PILOTA-00, su cui Luca ha attività.
	[LUCA]: ["NA-TRASF-01", "DF-2025-02"],
	[SARA]: ["OB-COACH-02", "TS-2025-01"],
	[PAOLO]: ["NA-PILOTA-00"],
};

async function main() {
	if (process.env.NODE_ENV === "production") {
		throw new Error("I dati dimostrativi non vanno caricati in produzione.");
	}

	const prisma = new PrismaClient({
		adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
	});

	try {
		const datiDemoGiaPresenti = await prisma.cliente.findFirst({
			where: { ragioneSociale: RAGIONE_SOCIALE_CLIENTE_MARCATORE },
		});
		if (datiDemoGiaPresenti) {
			console.log(
				"ℹ️  Dati dimostrativi già presenti: nessuna scrittura. Per ripartire da zero ricreare il database.",
			);
			return;
		}

		const righeCreate = await prisma.$transaction(
			async (transazione) => {
				// ── Utenti e collaboratori ───────────────────────────────
				const nuoviCollaboratori = [
					{
						email: ELENA, nome: "Elena", cognome: "Ferri", partitaIva: "34567890123", attivo: true,
						// Cambio tariffa due mesi fa.
						tariffe: [
							{ validaDalMese: "2020-01", modalita: "GIORNALIERA" as const, importo: "300.00" },
							{ validaDalMese: chiaveMeseRelativo(2), modalita: "GIORNALIERA" as const, importo: "340.00" },
						],
					},
					{
						email: LUCA, nome: "Luca", cognome: "Moretti", partitaIva: "45678901234", attivo: true,
						// Agile Reloaded trattiene il 20% della tariffa dell'offerta.
						tariffe: [{ validaDalMese: "2020-01", modalita: "PERCENTUALE" as const, importo: "20.00" }],
					},
					{
						email: SARA, nome: "Sara", cognome: "Galli", partitaIva: null, attivo: true,
						// Decorre da 4 mesi fa: il mese -5 è lavorato senza tariffa.
						tariffe: [{ validaDalMese: chiaveMeseRelativo(4), modalita: "FISSO_MENSILE" as const, importo: "3500.00" }],
					},
					{
						email: PAOLO, nome: "Paolo", cognome: "Riva", partitaIva: "56789012345", attivo: false,
						tariffe: [{ validaDalMese: "2020-01", validaAlMese: chiaveMeseRelativo(3), modalita: "GIORNALIERA" as const, importo: "280.00" }],
					},
					{ email: CHIARA, nome: "Chiara", cognome: "Neri", partitaIva: null, attivo: true, tariffe: [] },
				];
				for (const { email, nome, cognome, partitaIva, attivo, tariffe } of nuoviCollaboratori) {
					await transazione.utente.create({
						data: {
							nome,
							cognome,
							email,
							ruolo: "COLLABORATORE",
							attivo,
							collaboratore: {
								create: { nome, cognome, partitaIva, attivo, tariffe: { create: tariffe } },
							},
						},
					});
				}

				// ── Clienti e offerte ────────────────────────────────────
				await transazione.cliente.create({
					data: {
						ragioneSociale: NORDICA, partitaIva: "66778899001", indirizzo: "Piazza Unità 3", citta: "Trieste", cap: "34121", provincia: "TS",
						pec: "nordica@pec.example.it", codiceDestinatario: "ABC1234", personaRiferimento: "Marta Zanin (HR)",
						offerte: {
							create: [
								{ codice: "NA-TRASF-01", descrizione: "Programma di trasformazione agile", tariffaGiornaliera: "600.00", giorniPrevisti: 300, gestioneTrasferta: "FORFETTARIA", importoTrasfertaForfettaria: "90.00", numeroOrdine: "ODA-4471", accountAgileReloaded: "Stefano Leli" },
								{ codice: "NA-PILOTA-00", descrizione: "Progetto pilota — concluso", tariffaGiornaliera: "580.00", giorniPrevisti: 60, attiva: false, note: "Chiusa al termine del pilota." },
							],
						},
					},
				});
				await transazione.cliente.create({
					data: {
						ragioneSociale: OFFICINE_BRENTA, partitaIva: "77889900112", indirizzo: "Via dell'Industria 21", citta: "Padova", cap: "35129", provincia: "PD",
						offerte: {
							create: [
								// Pochi giorni previsti: l'erogato li supera abbondantemente.
								{ codice: "OB-COACH-02", descrizione: "Coaching team di produzione", tariffaGiornaliera: "500.00", giorniPrevisti: 12 },
								{ codice: "OB-DEFINIRE-03", descrizione: "Nuova linea di servizio (condizioni da definire)" },
							],
						},
					},
				});
				await transazione.cliente.create({
					data: {
						ragioneSociale: LUMEN, partitaIva: "88990011223", citta: "Firenze", provincia: "FI",
						offerte: {
							create: [{ codice: "LE-PILOTA-01", descrizione: "Pilota formazione docenti", tariffaGiornaliera: "520.00", giorniPrevisti: 15 }],
						},
					},
				});
				await transazione.cliente.create({
					data: { ragioneSociale: STUDIO_AURORA, note: "Primo contatto: offerta in preparazione." },
				});

				const clienti = await transazione.cliente.findMany();
				const idClientePerRagioneSociale = new Map(clienti.map((c) => [c.ragioneSociale, c.id]));
				const idCliente = (ragioneSociale: string) => {
					const id = idClientePerRagioneSociale.get(ragioneSociale);
					if (!id) throw new Error(`Cliente "${ragioneSociale}" assente: eseguire prima il seed di base (prisma db seed).`);
					return id;
				};

				// Offerte aggiunte ai clienti del seed di base.
				await transazione.offerta.createMany({
					data: [
						{ codice: "TS-FORF-02", descrizione: "Formazione DevOps in sede", clienteId: idCliente(TECHSOLUTIONS), tariffaGiornaliera: "650.00", giorniPrevisti: 30, gestioneTrasferta: "FORFETTARIA", importoTrasfertaForfettaria: "120.00" },
						{ codice: "DF-STORICO-01", descrizione: "Assessment iniziale — concluso", clienteId: idCliente(DATAFLOW), tariffaGiornaliera: "450.00", giorniPrevisti: 8, attiva: false },
					],
				});

				const offerte = await transazione.offerta.findMany();
				const idOffertaPerCodice = new Map(offerte.map((o) => [o.codice, o.id]));
				const idOfferta = (codice: string) => {
					const id = idOffertaPerCodice.get(codice);
					if (!id) throw new Error(`Offerta "${codice}" assente: eseguire prima il seed di base (prisma db seed).`);
					return id;
				};

				const collaboratori = await transazione.collaboratore.findMany({ include: { utente: true } });
				const idCollaboratorePerEmail = new Map(collaboratori.map((c) => [c.utente.email, c.id]));
				const idCollaboratore = (email: string) => {
					const id = idCollaboratorePerEmail.get(email);
					if (!id) throw new Error(`Collaboratore "${email}" assente: eseguire prima il seed di base (prisma db seed).`);
					return id;
				};

				const vociRimborso = await transazione.voceRimborsoTrasferta.findMany();
				const importoRimborsoPerEtichetta = new Map(vociRimborso.map((v) => [v.etichetta, v.importo]));

				// ── Abilitazioni ─────────────────────────────────────────
				await transazione.abilitazioneOfferta.createMany({
					data: Object.entries(ABILITAZIONI_PER_COLLABORATORE).flatMap(([email, codiciOfferta]) =>
						codiciOfferta.map((codice) => ({
							collaboratoreId: idCollaboratore(email),
							offertaId: idOfferta(codice),
						})),
					),
					skipDuplicates: true,
				});

				// ── Attività ─────────────────────────────────────────────
				const righeAttivita = PIANI_ATTIVITA.flatMap((piano) => {
					const etichettaRimborso = piano.etichettaRimborsoTrasferta;
					if (etichettaRimborso && !importoRimborsoPerEtichetta.has(etichettaRimborso)) {
						throw new Error(`Voce di rimborso "${etichettaRimborso}" assente: eseguire prima il seed di base (prisma db seed).`);
					}
					const date: Date[] = [];
					for (let mesiIndietro = piano.daMesiIndietro; mesiIndietro >= piano.aMesiIndietro; mesiIndietro--) {
						date.push(...dateDelMeseNeiGiorniDellaSettimana(mesiIndietro, piano.giorniDellaSettimana));
					}
					return date.map((data) => ({
						collaboratoreId: idCollaboratore(piano.emailCollaboratore),
						clienteId: idCliente(piano.ragioneSocialeCliente),
						offertaId: piano.codiceOfferta ? idOfferta(piano.codiceOfferta) : null,
						data,
						ore: piano.ore,
						nota: piano.nota,
						categoria: piano.categoria,
						inAffiancamento: piano.inAffiancamento ?? false,
						rimborsoTrasfertaEtichetta: etichettaRimborso ?? null,
						rimborsoTrasfertaImporto: etichettaRimborso ? importoRimborsoPerEtichetta.get(etichettaRimborso) : null,
					}));
				});
				await transazione.rigaAttivita.createMany({ data: righeAttivita });

				// ── Righe sospese già risolte (il seed di base ne ha solo di aperte) ──
				const meseScorso = chiaveMeseRelativo(1);
				await transazione.rigaAttivitaSospesa.createMany({
					data: [
						{ collaboratore: "Elena Ferri", data: `${meseScorso}-04`, cliente: "Nordica Ass.", codiceOfferta: "NA-TRASF-01", ore: "8", tipologiaFatturazione: "FATTURABILE", motivo: "CLIENTE_SCONOSCIUTO", nota: "Ragione sociale abbreviata nel foglio", risoltaIl: new Date() },
						{ collaboratore: "Luca Moretti", data: `${meseScorso}-11`, cliente: NORDICA, codiceOfferta: "NA-TRASF-1", ore: "8", tipologiaFatturazione: "FATTURABILE", motivo: "OFFERTA_SCONOSCIUTA", risoltaIl: new Date() },
						{ collaboratore: "S. Galli", data: `${meseScorso}-12`, cliente: OFFICINE_BRENTA, codiceOfferta: "OB-COACH-02", ore: "8", tipologiaFatturazione: "FATTURABILE", motivo: "COLLABORATORE_SCONOSCIUTO" },
					],
				});

				return righeAttivita.length;
			},
			{ timeout: 60_000 },
		);

		console.log(
			`✅ Dati dimostrativi caricati: 5 collaboratori, 4 clienti, 7 offerte, ${righeCreate} righe di attività.`,
		);
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((errore) => {
	console.error("❌ Errore durante il caricamento dei dati dimostrativi:", errore);
	process.exit(1);
});
