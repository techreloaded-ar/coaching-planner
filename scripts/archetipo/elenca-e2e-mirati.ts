/**
 * Stampa le spec e2e da eseguire nella verifica locale del checkout.
 *
 * Uscita standard: la prima riga è `completa` oppure `mirata`; con `mirata`
 * seguono le spec, una per riga. Le spiegazioni vanno sull'errore standard,
 * così finiscono nel log del check senza sporcare l'elenco.
 *
 * Variabili d'ambiente:
 *   E2E_SUITE_COMPLETA=1   forza la suite completa
 *   E2E_MIRATI_BASE=<ref>  ramo o commit di confronto (predefinito: origin/main, poi main)
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
	CARTELLA_E2E,
	CARTELLA_SORGENTI,
	selezionaSpecE2eMirate,
	type SelezioneE2e,
} from "./selezione-e2e-mirati";

const RADICE = process.cwd();
const ESTENSIONI_LETTE = /\.(ts|tsx|css)$/;
const CARTELLE_ESCLUSE = new Set(["generated", "node_modules"]);

function git(...argomenti: string[]): string {
	return execFileSync("git", argomenti, {
		cwd: RADICE,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	}).trim();
}

function righe(testo: string): string[] {
	return testo
		.split("\n")
		.map((riga) => riga.trim())
		.filter((riga) => riga !== "");
}

function baseDiConfronto(): string {
	const candidati = [
		process.env.E2E_MIRATI_BASE?.trim(),
		"origin/main",
		"main",
	].filter((candidato): candidato is string => Boolean(candidato));
	for (const candidato of candidati) {
		try {
			return git("merge-base", "HEAD", candidato);
		} catch {
			// Ramo assente in questo checkout: si prova il successivo.
		}
	}
	throw new Error(
		`nessun ramo di confronto disponibile (${candidati.join(", ")})`,
	);
}

/** Commit del ramo, modifiche non ancora committate e file nuovi non tracciati. */
function fileModificatiRispettoAllaBase(): string[] {
	const base = baseDiConfronto();
	return [
		...righe(git("diff", "--name-only", base)),
		...righe(git("ls-files", "--others", "--exclude-standard")),
	];
}

function leggiContenuti(cartella: string): Record<string, string> {
	const contenuti: Record<string, string> = {};
	const visita = (relativa: string) => {
		for (const voce of readdirSync(path.join(RADICE, relativa), {
			withFileTypes: true,
		})) {
			const percorso = `${relativa}/${voce.name}`;
			if (voce.isDirectory()) {
				if (!CARTELLE_ESCLUSE.has(voce.name)) visita(percorso);
			} else if (ESTENSIONI_LETTE.test(voce.name)) {
				contenuti[percorso] = readFileSync(path.join(RADICE, percorso), "utf8");
			}
		}
	};
	visita(cartella);
	return contenuti;
}

function seleziona(): SelezioneE2e {
	if (process.env.E2E_SUITE_COMPLETA === "1") {
		return { modalita: "completa", motivi: ["richiesta con E2E_SUITE_COMPLETA=1"] };
	}
	let fileModificati: string[];
	try {
		fileModificati = fileModificatiRispettoAllaBase();
	} catch (errore) {
		const dettaglio = errore instanceof Error ? errore.message : String(errore);
		return {
			modalita: "completa",
			motivi: [`modifiche non determinabili da Git: ${dettaglio}`],
		};
	}
	return selezionaSpecE2eMirate({
		fileModificati,
		contenutoFileSorgente: leggiContenuti(CARTELLA_SORGENTI),
		contenutoFileE2e: leggiContenuti(CARTELLA_E2E),
	});
}

const selezione = seleziona();

if (selezione.modalita === "completa") {
	console.error("E2E: suite completa.");
	for (const motivo of selezione.motivi) console.error(`  - ${motivo}`);
	console.log("completa");
} else {
	console.error(
		`E2E mirati: ${selezione.spec.length} spec (la suite completa gira in CI sulla pull request).`,
	);
	for (const spec of selezione.spec) {
		console.error(`  - ${spec}: ${selezione.motiviPerSpec[spec].join("; ")}`);
	}
	for (const avviso of selezione.avvisi) console.error(`  ! ${avviso}`);
	console.log(["mirata", ...selezione.spec].join("\n"));
}
