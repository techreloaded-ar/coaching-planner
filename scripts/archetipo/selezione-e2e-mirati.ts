/**
 * Selezione degli e2e mirati per la verifica locale di un checkout.
 *
 * La suite Playwright completa gira in CI sulla pull request; in locale si
 * eseguono solo le spec che toccano ciò che è cambiato rispetto al ramo base,
 * così il riscontro arriva in secondi invece che in minuti.
 *
 * Regole, in ordine:
 * 1. un file che incide su tutta l'applicazione (schema Prisma, configurazione
 *    di Playwright o Next, proxy, layout radice…) richiede la suite completa;
 * 2. una spec modificata viene eseguita;
 * 3. un helper e2e modificato porta con sé tutte le spec che lo importano;
 * 4. un sorgente modificato porta con sé le spec con il suo stesso nome
 *    (`esportazione-fatturazione.ts` → `esportazione-fatturazione.spec.ts`);
 * 5. un sorgente modificato porta con sé le spec che visitano le rotte che lo
 *    usano, seguendo il grafo degli import fino a `page.tsx` e `route.ts`.
 *    Un modulo condiviso da molte rotte non viene espanso: selezionerebbe quasi
 *    tutta la suite, e il suo impatto ampio lo verifica la CI;
 * 6. ogni spec selezionata porta con sé la gemella `demo__…` (e viceversa);
 * 7. le spec di fumo girano sempre, per provare che la build parte e si accede.
 *
 * Questo modulo è puro: riceve elenchi e contenuti, non legge file né Git.
 */

export const CARTELLA_E2E = "tests/e2e";
export const CARTELLA_SORGENTI = "src";
const CARTELLA_APP = "src/app";
const PREFISSO_SPEC_DEMO = "demo__";
const SUFFISSO_SPEC = ".spec.ts";

/** Girano a ogni verifica: la build di produzione parte e l'accesso funziona. */
export const SPEC_SEMPRE_ESEGUITE = [
	"tests/e2e/home-page.spec.ts",
	"tests/e2e/auth-flows.spec.ts",
];

/** File la cui modifica può cambiare il comportamento di qualunque pagina. */
const FILE_CHE_RICHIEDONO_SUITE_COMPLETA = new Set([
	"playwright.config.ts",
	"package.json",
	"package-lock.json",
	"next.config.ts",
	"prisma.config.ts",
	"tsconfig.json",
	"postcss.config.mjs",
	"tests/e2e/global-setup.ts",
	"tests/e2e/global-teardown.ts",
	"tests/e2e/e2e-database-safety.ts",
	"src/app/layout.tsx",
	"src/app/globals.css",
]);

/**
 * Oltre questo numero di rotte un sorgente è considerato condiviso: espanderlo
 * selezionerebbe gran parte della suite, che in locale non è l'obiettivo.
 */
export const SOGLIA_ROTTE_MODULO_CONDIVISO = 10;

/** Lunghezza minima di un nome perché l'affinità con una spec sia significativa. */
const LUNGHEZZA_MINIMA_NOME_AFFINE = 5;

/** Nomi di file che non dicono nulla da soli: vale il nome della cartella. */
const NOMI_FILE_GENERICI = new Set([
	"index",
	"page",
	"route",
	"layout",
	"actions",
	"types",
	"loading",
	"error",
	"not-found",
	"template",
	"default",
]);

const CARTELLE_CHE_RICHIEDONO_SUITE_COMPLETA = ["prisma/", "public/"];

/** Punti d'ingresso che Next esegue per ogni richiesta, fuori da `src/app`. */
const INGRESSI_GLOBALI = ["src/proxy.ts", "src/instrumentation.ts"];

const CARTELLA_SORGENTI_GENERATI = "src/generated/";

/** File di `src/app` che avvolgono tutte le rotte della propria cartella. */
const FILE_DI_CONTORNO_ROTTA =
	/^(layout|template|loading|error|not-found|default|global-error)\.tsx?$/;

const FILE_DI_ROTTA = /^(page|route)\.tsx?$/;

export interface IngressoSelezioneE2e {
	/** Percorsi relativi alla radice del checkout, con separatore `/`. */
	fileModificati: string[];
	/** Contenuto dei file sotto `src/`, per percorso. */
	contenutoFileSorgente: Record<string, string>;
	/** Contenuto dei file sotto `tests/e2e/`, per percorso. */
	contenutoFileE2e: Record<string, string>;
}

export type SelezioneE2e =
	| { modalita: "completa"; motivi: string[] }
	| {
			modalita: "mirata";
			/** Spec da eseguire, ordinate. */
			spec: string[];
			/** Per ogni spec, perché è stata scelta. */
			motiviPerSpec: Record<string, string[]>;
			/** Avvisi su ciò che la selezione non copre: lo verifica la CI. */
			avvisi: string[];
	  };

function cartellaDi(percorso: string): string {
	const ultimaBarra = percorso.lastIndexOf("/");
	return ultimaBarra === -1 ? "" : percorso.slice(0, ultimaBarra);
}

function nomeFileDi(percorso: string): string {
	return percorso.slice(percorso.lastIndexOf("/") + 1);
}

function normalizzaPercorso(percorso: string): string {
	const segmenti: string[] = [];
	for (const segmento of percorso.split("/")) {
		if (segmento === "" || segmento === ".") continue;
		if (segmento === "..") segmenti.pop();
		else segmenti.push(segmento);
	}
	return segmenti.join("/");
}

/**
 * Specificatori di `import … from`, `import()`, `export … from` e
 * `require()`, esclusi gli `import type`.
 */
export function estraiSpecificatoriImport(contenuto: string): string[] {
	// Un import di soli tipi sparisce in compilazione: non è una dipendenza.
	contenuto = contenuto.replace(
		/\b(?:import|export)\s+type\s[^;]*?from\s*["'][^"']+["']/g,
		"",
	);
	const specificatori: string[] = [];
	const espressioni = [
		/\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g,
		/\brequire\(\s*["']([^"']+)["']\s*\)/g,
	];
	for (const espressione of espressioni) {
		for (const corrispondenza of contenuto.matchAll(espressione)) {
			specificatori.push(corrispondenza[1]);
		}
	}
	return specificatori;
}

function risolviImport(
	fileImportatore: string,
	specificatore: string,
	fileEsistenti: ReadonlySet<string>,
): string | null {
	let base: string;
	if (specificatore.startsWith("@/")) {
		base = `${CARTELLA_SORGENTI}/${specificatore.slice(2)}`;
	} else if (specificatore.startsWith(".")) {
		base = `${cartellaDi(fileImportatore)}/${specificatore}`;
	} else {
		return null;
	}
	const percorso = normalizzaPercorso(base);
	const candidati = [
		percorso,
		`${percorso}.ts`,
		`${percorso}.tsx`,
		`${percorso}/index.ts`,
		`${percorso}/index.tsx`,
	];
	return candidati.find((candidato) => fileEsistenti.has(candidato)) ?? null;
}

type GrafoDipendenze = Map<string, Set<string>>;

function costruisciGrafoImport(
	contenutoPerFile: Record<string, string>,
): GrafoDipendenze {
	const fileEsistenti = new Set(Object.keys(contenutoPerFile));
	const grafo: GrafoDipendenze = new Map();
	for (const [file, contenuto] of Object.entries(contenutoPerFile)) {
		const dipendenze = new Set<string>();
		if (/\.tsx?$/.test(file)) {
			for (const specificatore of estraiSpecificatoriImport(contenuto)) {
				const risolto = risolviImport(file, specificatore, fileEsistenti);
				if (risolto && risolto !== file) dipendenze.add(risolto);
			}
		}
		grafo.set(file, dipendenze);
	}
	return grafo;
}

function chiusuraDipendenze(
	partenza: string,
	grafo: GrafoDipendenze,
): Set<string> {
	const visitati = new Set<string>([partenza]);
	const daVisitare = [partenza];
	while (daVisitare.length > 0) {
		const corrente = daVisitare.pop() as string;
		for (const dipendenza of grafo.get(corrente) ?? []) {
			if (!visitati.has(dipendenza)) {
				visitati.add(dipendenza);
				daVisitare.push(dipendenza);
			}
		}
	}
	return visitati;
}

type SegmentoRotta =
	| { tipo: "fisso"; valore: string }
	| { tipo: "qualsiasi" }
	| { tipo: "resto"; facoltativo: boolean };

interface Rotta {
	file: string;
	percorso: string;
	segmenti: SegmentoRotta[];
}

/** `src/app/(back-office)/offerte/[offertaId]/page.tsx` → `/offerte/[offertaId]`. */
export function rottaDelFile(fileDiRotta: string): string {
	const segmenti = cartellaDi(fileDiRotta)
		.slice(CARTELLA_APP.length)
		.split("/")
		.filter((segmento) => segmento !== "" && !/^\(.*\)$/.test(segmento));
	return `/${segmenti.join("/")}`;
}

function segmentiDellaRotta(percorso: string): SegmentoRotta[] {
	return percorso
		.split("/")
		.filter((segmento) => segmento !== "")
		.map((segmento): SegmentoRotta => {
			if (/^\[\[\.\.\..+\]\]$/.test(segmento)) {
				return { tipo: "resto", facoltativo: true };
			}
			if (/^\[\.\.\..+\]$/.test(segmento)) {
				return { tipo: "resto", facoltativo: false };
			}
			if (/^\[.+\]$/.test(segmento)) return { tipo: "qualsiasi" };
			return { tipo: "fisso", valore: segmento };
		});
}

/** Prefisso senza parametri di una rotta: `/offerte/[id]/x` → `/offerte`. */
function prefissoFissoDellaRotta(rotta: Rotta): string {
	const fissi: string[] = [];
	for (const segmento of rotta.segmenti) {
		if (segmento.tipo !== "fisso") break;
		fissi.push(segmento.valore);
	}
	return `/${fissi.join("/")}`;
}

const SEGNAPOSTO_PARAMETRO = "*";

/**
 * Percorsi citati in un file di test: stringhe e template che iniziano con `/`
 * e le forme con barre protette delle espressioni regolari (`/\/offerte\/x/`).
 * Le interpolazioni `${…}` diventano un segmento qualsiasi.
 */
export function estraiPercorsiCitati(contenuto: string): string[][] {
	const grezzi: string[] = [];
	for (const corrispondenza of contenuto.matchAll(/["'`](\/[^"'`\s]*)/g)) {
		grezzi.push(corrispondenza[1]);
	}
	for (const corrispondenza of contenuto.matchAll(
		/(?:\\\/[A-Za-z0-9_-]+)+/g,
	)) {
		grezzi.push(corrispondenza[0].replaceAll("\\/", "/"));
	}
	const percorsi: string[][] = [];
	for (const grezzo of grezzi) {
		const senzaInterpolazioni = grezzo.replace(
			/\$\{[^}]*\}/g,
			SEGNAPOSTO_PARAMETRO,
		);
		const soloPercorso = senzaInterpolazioni.split(/[?#]/)[0];
		const segmenti = soloPercorso
			.split("/")
			.filter((segmento) => segmento !== "")
			.map((segmento) =>
				segmento.includes(SEGNAPOSTO_PARAMETRO)
					? SEGNAPOSTO_PARAMETRO
					: segmento,
			);
		percorsi.push(segmenti);
	}
	return percorsi;
}

function segmentoCorrisponde(citato: string, segmento: SegmentoRotta): boolean {
	if (segmento.tipo !== "fisso") return true;
	return citato === SEGNAPOSTO_PARAMETRO || citato === segmento.valore;
}

/** Il percorso citato è esattamente quella rotta. */
function percorsoCoincideConRotta(citato: string[], rotta: Rotta): boolean {
	const segmenti = rotta.segmenti;
	const ultimo = segmenti[segmenti.length - 1];
	if (ultimo?.tipo === "resto") {
		const fissi = segmenti.length - 1;
		const minimo = ultimo.facoltativo ? fissi : fissi + 1;
		if (citato.length < minimo) return false;
		return segmenti
			.slice(0, fissi)
			.every((segmento, indice) =>
				segmentoCorrisponde(citato[indice], segmento),
			);
	}
	if (citato.length !== segmenti.length) return false;
	return segmenti.every((segmento, indice) =>
		segmentoCorrisponde(citato[indice], segmento),
	);
}

/**
 * Il percorso citato è una pagina che contiene la rotta (es. l'elenco da cui
 * si apre un dettaglio con un clic). La radice `/` non conta: contiene tutto.
 */
function percorsoContieneRotta(citato: string[], rotta: Rotta): boolean {
	if (citato.length === 0 || citato.length >= rotta.segmenti.length) {
		return false;
	}
	return citato.every((segmentoCitato, indice) => {
		const segmento = rotta.segmenti[indice];
		return segmento.tipo === "fisso" && segmento.valore === segmentoCitato;
	});
}

function contieneLetterale(contenuto: string, percorso: string): boolean {
	let indice = contenuto.indexOf(percorso);
	while (indice !== -1) {
		const successivo = contenuto[indice + percorso.length] ?? "";
		if (!/[A-Za-z0-9_-]/.test(successivo)) return true;
		indice = contenuto.indexOf(percorso, indice + 1);
	}
	return false;
}

function gemellaDellaSpec(spec: string): string {
	const nome = nomeFileDi(spec);
	const cartella = cartellaDi(spec);
	const nomeGemella = nome.startsWith(PREFISSO_SPEC_DEMO)
		? nome.slice(PREFISSO_SPEC_DEMO.length)
		: `${PREFISSO_SPEC_DEMO}${nome}`;
	return `${cartella}/${nomeGemella}`;
}

function senzaEstensione(nomeFile: string): string {
	return nomeFile.replace(/\.[^.]+$/, "");
}

/**
 * Nome con cui cercare le spec affini a un sorgente: il nome del file, oppure
 * quello della cartella quando il file ha un nome generico (`index.ts`).
 * Per i file generici di `src/app` non c'è nome: li copre la loro rotta.
 */
export function nomeSignificativoDelSorgente(sorgente: string): string | null {
	const nome = senzaEstensione(nomeFileDi(sorgente));
	if (!NOMI_FILE_GENERICI.has(nome)) return nome;
	if (sorgente.startsWith(`${CARTELLA_APP}/`)) return null;
	return nomeFileDi(cartellaDi(sorgente)) || null;
}

function nomeDellaSpec(spec: string): string {
	const nome = nomeFileDi(spec).slice(0, -SUFFISSO_SPEC.length);
	return nome.startsWith(PREFISSO_SPEC_DEMO)
		? nome.slice(PREFISSO_SPEC_DEMO.length)
		: nome;
}

function nomiAffini(nomeSorgente: string, nomeSpec: string): boolean {
	const [corto, lungo] =
		nomeSorgente.length <= nomeSpec.length
			? [nomeSorgente, nomeSpec]
			: [nomeSpec, nomeSorgente];
	return corto.length >= LUNGHEZZA_MINIMA_NOME_AFFINE && lungo.includes(corto);
}

function richiedeSuiteCompleta(file: string): boolean {
	return (
		FILE_CHE_RICHIEDONO_SUITE_COMPLETA.has(file) ||
		CARTELLE_CHE_RICHIEDONO_SUITE_COMPLETA.some((cartella) =>
			file.startsWith(cartella),
		)
	);
}

export function selezionaSpecE2eMirate(
	ingresso: IngressoSelezioneE2e,
): SelezioneE2e {
	const { contenutoFileSorgente, contenutoFileE2e } = ingresso;
	const fileModificati = [...new Set(ingresso.fileModificati)].sort();

	const motiviSuiteCompleta = fileModificati
		.filter(richiedeSuiteCompleta)
		.map((file) => `${file} incide su tutta l'applicazione`);

	// --- Grafo dei sorgenti, con i file di contorno e le chiamate alle route ---
	const grafoSorgenti = costruisciGrafoImport(contenutoFileSorgente);
	const fileSorgente = Object.keys(contenutoFileSorgente);
	const rotte: Rotta[] = fileSorgente
		.filter(
			(file) =>
				file.startsWith(`${CARTELLA_APP}/`) &&
				FILE_DI_ROTTA.test(nomeFileDi(file)),
		)
		.map((file) => {
			const percorso = rottaDelFile(file);
			return { file, percorso, segmenti: segmentiDellaRotta(percorso) };
		});

	const fileDiContorno = fileSorgente.filter(
		(file) =>
			file.startsWith(`${CARTELLA_APP}/`) &&
			FILE_DI_CONTORNO_ROTTA.test(nomeFileDi(file)),
	);
	for (const rotta of rotte) {
		const cartellaRotta = `${cartellaDi(rotta.file)}/`;
		for (const contorno of fileDiContorno) {
			if (cartellaRotta.startsWith(`${cartellaDi(contorno)}/`)) {
				grafoSorgenti.get(rotta.file)?.add(contorno);
			}
		}
	}

	// Un componente che chiama una route con `fetch("/api/…")` dipende da lei
	// quanto da un import: la stringa del percorso è l'unico legame nel codice.
	const routeHandler = rotte.filter((rotta) =>
		/^route\.tsx?$/.test(nomeFileDi(rotta.file)),
	);
	for (const rotta of routeHandler) {
		const prefisso = prefissoFissoDellaRotta(rotta);
		if (prefisso === "/") continue;
		for (const [file, contenuto] of Object.entries(contenutoFileSorgente)) {
			if (file === rotta.file || !/\.tsx?$/.test(file)) continue;
			// Solo chi può davvero chiamarla: un elenco di percorsi (es. la
			// policy delle rotte pubbliche) cita la route senza dipenderne.
			const puoChiamareRoute =
				contenuto.includes("fetch(") || /^\s*["']use client["']/.test(contenuto);
			if (puoChiamareRoute && contieneLetterale(contenuto, prefisso)) {
				grafoSorgenti.get(file)?.add(rotta.file);
			}
		}
	}

	const chiusuraPerRotta = new Map<string, Set<string>>(
		rotte.map((rotta) => [
			rotta.file,
			chiusuraDipendenze(rotta.file, grafoSorgenti),
		]),
	);
	const fileDegliIngressiGlobali = new Set<string>();
	for (const ingressoGlobale of INGRESSI_GLOBALI) {
		if (!(ingressoGlobale in contenutoFileSorgente)) continue;
		for (const file of chiusuraDipendenze(ingressoGlobale, grafoSorgenti)) {
			fileDegliIngressiGlobali.add(file);
		}
	}

	// --- Sorgenti modificati → rotte toccate ---
	const avvisi: string[] = [];
	const sorgentiPerRotta = new Map<string, Set<string>>();
	const sorgentiPresenti: string[] = [];
	const sorgentiModificati = fileModificati.filter(
		(file) =>
			file.startsWith(`${CARTELLA_SORGENTI}/`) &&
			!file.startsWith(CARTELLA_SORGENTI_GENERATI),
	);
	for (const sorgente of sorgentiModificati) {
		if (!(sorgente in contenutoFileSorgente)) {
			avvisi.push(
				`${sorgente} è stato rimosso: lo coprono i file che lo importavano`,
			);
			continue;
		}
		if (fileDegliIngressiGlobali.has(sorgente)) {
			motiviSuiteCompleta.push(
				`${sorgente} è usato da proxy o instrumentation, eseguiti a ogni richiesta`,
			);
			continue;
		}
		const rotteToccate = rotte.filter((rotta) =>
			chiusuraPerRotta.get(rotta.file)?.has(sorgente),
		);
		sorgentiPresenti.push(sorgente);
		if (rotteToccate.length === 0) {
			avvisi.push(`${sorgente} non è raggiunto da alcuna rotta`);
			continue;
		}
		if (rotteToccate.length > SOGLIA_ROTTE_MODULO_CONDIVISO) {
			avvisi.push(
				`${sorgente} è condiviso da ${rotteToccate.length} rotte: l'impatto ampio lo verifica la CI`,
			);
			continue;
		}
		for (const rotta of rotteToccate) {
			if (!sorgentiPerRotta.has(rotta.file)) {
				sorgentiPerRotta.set(rotta.file, new Set());
			}
			sorgentiPerRotta.get(rotta.file)?.add(sorgente);
		}
	}

	if (motiviSuiteCompleta.length > 0) {
		return { modalita: "completa", motivi: motiviSuiteCompleta };
	}

	// --- Spec: chi importa cosa e quali percorsi visita ---
	const grafoE2e = costruisciGrafoImport(contenutoFileE2e);
	const tutteLeSpec = Object.keys(contenutoFileE2e)
		.filter((file) => file.endsWith(SUFFISSO_SPEC))
		.sort();
	const insiemeSpec = new Set(tutteLeSpec);
	const motiviPerSpec: Record<string, string[]> = {};
	const aggiungi = (spec: string, motivo: string) => {
		if (!insiemeSpec.has(spec)) return;
		if (!motiviPerSpec[spec]) motiviPerSpec[spec] = [];
		if (!motiviPerSpec[spec].includes(motivo)) motiviPerSpec[spec].push(motivo);
	};

	const fileE2eModificati = fileModificati.filter((file) =>
		file.startsWith(`${CARTELLA_E2E}/`),
	);
	const chiusuraPerSpec = new Map<string, Set<string>>(
		tutteLeSpec.map((spec) => [spec, chiusuraDipendenze(spec, grafoE2e)]),
	);
	for (const file of fileE2eModificati) {
		if (file.endsWith(SUFFISSO_SPEC)) {
			aggiungi(file, "spec modificata");
			continue;
		}
		for (const spec of tutteLeSpec) {
			if (chiusuraPerSpec.get(spec)?.has(file)) {
				aggiungi(spec, `importa ${file}`);
			}
		}
	}

	for (const sorgente of sorgentiPresenti) {
		const nomeSorgente = nomeSignificativoDelSorgente(sorgente);
		if (!nomeSorgente) continue;
		for (const spec of tutteLeSpec) {
			if (nomiAffini(nomeSorgente, nomeDellaSpec(spec))) {
				aggiungi(spec, `stesso nome di ${sorgente}`);
			}
		}
	}

	const rotteToccate = rotte.filter((rotta) => sorgentiPerRotta.has(rotta.file));
	if (rotteToccate.length > 0) {
		const percorsiPropriPerSpec = new Map<string, string[][]>();
		const percorsiConHelperPerSpec = new Map<string, string[][]>();
		for (const spec of tutteLeSpec) {
			percorsiPropriPerSpec.set(
				spec,
				estraiPercorsiCitati(contenutoFileE2e[spec]),
			);
			const conHelper: string[][] = [];
			for (const file of chiusuraPerSpec.get(spec) ?? []) {
				conHelper.push(...estraiPercorsiCitati(contenutoFileE2e[file] ?? ""));
			}
			percorsiConHelperPerSpec.set(spec, conHelper);
		}
		for (const rotta of rotteToccate) {
			const sorgenti = [...(sorgentiPerRotta.get(rotta.file) ?? [])].sort();
			const motivo = `visita ${rotta.percorso} (${sorgenti.join(", ")})`;
			// Prima le spec che citano esattamente la rotta, anche tramite helper.
			// Solo se nessuna la cita si ripiega su quelle che citano una pagina
			// che la contiene (l'elenco da cui si apre il dettaglio con un clic).
			let specCheVisitano = tutteLeSpec.filter((spec) =>
				percorsiConHelperPerSpec
					.get(spec)
					?.some((citato) => percorsoCoincideConRotta(citato, rotta)),
			);
			if (specCheVisitano.length === 0) {
				specCheVisitano = tutteLeSpec.filter((spec) =>
					percorsiPropriPerSpec
						.get(spec)
						?.some((citato) => percorsoContieneRotta(citato, rotta)),
				);
			}
			for (const spec of specCheVisitano) aggiungi(spec, motivo);
			if (specCheVisitano.length === 0) {
				avvisi.push(
					`nessuna spec cita ${rotta.percorso} (${sorgenti.join(", ")})`,
				);
			}
		}
	}

	for (const spec of Object.keys(motiviPerSpec)) {
		aggiungi(gemellaDellaSpec(spec), `gemella di ${nomeFileDi(spec)}`);
	}
	for (const spec of SPEC_SEMPRE_ESEGUITE) {
		aggiungi(spec, "spec di fumo, sempre eseguita");
	}

	return {
		modalita: "mirata",
		spec: Object.keys(motiviPerSpec).sort(),
		motiviPerSpec,
		avvisi,
	};
}
