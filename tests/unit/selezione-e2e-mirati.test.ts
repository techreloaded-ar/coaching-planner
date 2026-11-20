/**
 * Test della selezione degli e2e mirati usata dalla verifica locale
 * (`scripts/archetipo/selezione-e2e-mirati.ts`).
 *
 * Il modulo è puro: riceve i file modificati e i contenuti di sorgenti e spec,
 * quindi ogni caso costruisce un piccolo progetto finto in memoria.
 */

import { describe, expect, it } from "vitest";

import {
	SOGLIA_ROTTE_MODULO_CONDIVISO,
	SPEC_SEMPRE_ESEGUITE,
	estraiPercorsiCitati,
	estraiSpecificatoriImport,
	nomeSignificativoDelSorgente,
	rottaDelFile,
	selezionaSpecE2eMirate,
	type SelezioneE2e,
} from "../../scripts/archetipo/selezione-e2e-mirati";

const SORGENTI: Record<string, string> = {
	"src/proxy.ts": 'import { leggiSessione } from "@/lib/sessione";',
	"src/lib/sessione.ts": "export const leggiSessione = () => null;",
	"src/app/layout.tsx": 'import "./globals.css";',
	"src/app/globals.css": "body {}",
	"src/app/(back-office)/layout.tsx":
		'import { Sidebar } from "@/app/sidebar-applicazione";',
	"src/app/sidebar-applicazione.tsx": "export const Sidebar = () => null;",
	"src/app/(back-office)/report/fatturazione-clienti/page.tsx":
		'import { Report } from "./report-fatturazione-clienti";\nimport { leggiReport } from "@/lib/report";',
	"src/app/(back-office)/report/fatturazione-clienti/report-fatturazione-clienti.tsx":
		'"use client";\nexport const Report = () => fetch("/report/fatturazione-clienti/esporta");',
	"src/app/(back-office)/report/fatturazione-clienti/esporta/route.ts":
		'import { creaFoglio } from "@/lib/esportazione-fatturazione";',
	"src/app/(back-office)/offerte/page.tsx":
		'import { elencoOfferte } from "@/lib/offerte";',
	"src/app/(back-office)/offerte/[offertaId]/page.tsx":
		'import { elencoOfferte } from "@/lib/offerte";\nimport type { Tariffa } from "@/domain/tariffe";',
	"src/lib/report.ts": 'import { ore } from "@/domain/consuntivi";',
	"src/lib/offerte.ts": 'import { ore } from "@/domain/consuntivi";',
	"src/lib/esportazione-fatturazione.ts":
		'import { ore } from "@/domain/consuntivi";',
	"src/lib/policy-rotte.ts":
		'export const ROTTE_PUBBLICHE = ["/report/fatturazione-clienti/esporta"];',
	"src/domain/consuntivi/index.ts": "export const ore = 1;",
	"src/domain/tariffe/index.ts": "export type Tariffa = number;",
	"src/lib/orfano.ts": "export const inutilizzato = 1;",
};

const E2E: Record<string, string> = {
	"tests/e2e/support/auth.ts":
		'export const accedi = (page) => page.goto("/anagrafiche");',
	"tests/e2e/support/report-data.ts": "export const dataset = {};",
	"tests/e2e/home-page.spec.ts": 'page.goto("/");',
	"tests/e2e/auth-flows.spec.ts": 'import { accedi } from "./support/auth";',
	"tests/e2e/report-fatturazione-clienti.spec.ts":
		'import { dataset } from "./support/report-data";\npage.goto(`/report/fatturazione-clienti?mese=${mese}`);',
	"tests/e2e/demo__report-fatturazione-clienti.spec.ts":
		"// apre il report dalla sidebar, senza citare percorsi",
	"tests/e2e/esportazione-fatturazione.spec.ts":
		'import { dataset } from "./support/report-data";\nawait expect(page).toHaveURL(/\\/report\\/fatturazione-clienti/);',
	"tests/e2e/demo__esportazione-fatturazione.spec.ts":
		"// scarica il file dalla pagina del report",
	"tests/e2e/gestione-offerte.spec.ts": 'page.goto("/offerte");',
	"tests/e2e/dettaglio-offerta.spec.ts":
		"page.goto(`/offerte/${offerta.id}`);",
	"tests/e2e/sidebar.spec.ts": "// naviga con i link della sidebar",
	"tests/e2e/temi.spec.ts": "// cambia tema dalle impostazioni",
};

function seleziona(...fileModificati: string[]): SelezioneE2e {
	return selezionaSpecE2eMirate({
		fileModificati,
		contenutoFileSorgente: SORGENTI,
		contenutoFileE2e: E2E,
	});
}

function specMirate(...fileModificati: string[]): string[] {
	const selezione = seleziona(...fileModificati);
	if (selezione.modalita !== "mirata") {
		throw new Error(`attesa selezione mirata: ${selezione.motivi.join("; ")}`);
	}
	return selezione.spec.map((spec) =>
		spec.replace("tests/e2e/", "").replace(".spec.ts", ""),
	);
}

function avvisi(...fileModificati: string[]): string[] {
	const selezione = seleziona(...fileModificati);
	return selezione.modalita === "mirata" ? selezione.avvisi : [];
}

const FUMO = ["auth-flows", "home-page"];

/** Le spec attese oltre a quelle di fumo, nell'ordine in cui escono. */
function conFumo(...spec: string[]): string[] {
	return [...FUMO, ...spec].sort();
}

describe("estrazione dagli import e dai percorsi", () => {
	it("ignora gli import di soli tipi e i pacchetti restano specificatori", () => {
		expect(
			estraiSpecificatoriImport(
				'import type { A } from "./tipi";\nimport { b } from "./valori";\nconst c = await import("./pigro");\nexport * from "./riesportato";',
			),
		).toEqual(["./valori", "./pigro", "./riesportato"]);
	});

	it("legge stringhe, template con interpolazioni ed espressioni regolari", () => {
		expect(
			estraiPercorsiCitati(
				'page.goto("/offerte?stato=aperte");\npage.goto(`/offerte/${id}/collaboratori`);\nexpect(page).toHaveURL(/\\/report\\/marginalita/);',
			),
		).toEqual([
			["offerte"],
			["offerte", "*", "collaboratori"],
			["report", "marginalita"],
		]);
	});

	it("ricava la rotta togliendo i gruppi tra parentesi", () => {
		expect(
			rottaDelFile("src/app/(back-office)/offerte/[offertaId]/page.tsx"),
		).toBe("/offerte/[offertaId]");
		expect(rottaDelFile("src/app/page.tsx")).toBe("/");
	});

	it("usa il nome della cartella quando il file ha un nome generico", () => {
		expect(nomeSignificativoDelSorgente("src/domain/consuntivi/index.ts")).toBe(
			"consuntivi",
		);
		expect(nomeSignificativoDelSorgente("src/lib/report.ts")).toBe("report");
		expect(
			nomeSignificativoDelSorgente("src/app/(back-office)/offerte/page.tsx"),
		).toBeNull();
	});
});

describe("selezione delle spec mirate", () => {
	it("senza modifiche esegue solo le spec di fumo", () => {
		expect(specMirate()).toEqual(FUMO);
		expect(SPEC_SEMPRE_ESEGUITE).toHaveLength(2);
	});

	it("ignora i file senza effetto sull'applicazione in esecuzione", () => {
		expect(
			specMirate("tests/unit/report.test.ts", "docs/PRD.md", "README.md"),
		).toEqual(FUMO);
	});

	it("una spec modificata porta con sé la gemella demo", () => {
		expect(specMirate("tests/e2e/esportazione-fatturazione.spec.ts")).toEqual(
			conFumo("demo__esportazione-fatturazione", "esportazione-fatturazione"),
		);
	});

	it("una spec demo modificata porta con sé la gemella funzionale", () => {
		expect(
			specMirate("tests/e2e/demo__report-fatturazione-clienti.spec.ts"),
		).toEqual(
			conFumo(
				"demo__report-fatturazione-clienti",
				"report-fatturazione-clienti",
			),
		);
	});

	it("un helper e2e modificato porta con sé le spec che lo importano", () => {
		expect(specMirate("tests/e2e/support/report-data.ts")).toEqual(
			conFumo(
				"demo__esportazione-fatturazione",
				"demo__report-fatturazione-clienti",
				"esportazione-fatturazione",
				"report-fatturazione-clienti",
			),
		);
	});

	it("una pagina modificata porta con sé le spec che citano la sua rotta", () => {
		expect(
			specMirate("src/app/(back-office)/report/fatturazione-clienti/page.tsx"),
		).toEqual(
			conFumo(
				"demo__esportazione-fatturazione",
				"demo__report-fatturazione-clienti",
				"esportazione-fatturazione",
				"report-fatturazione-clienti",
			),
		);
	});

	it("una libreria segue gli import fino alla route e, se nessuna spec la cita, ripiega sulla pagina che la contiene", () => {
		const spec = specMirate("src/lib/esportazione-fatturazione.ts");
		// Stesso nome del sorgente, più le spec che citano la pagina del report.
		expect(spec).toContain("esportazione-fatturazione");
		expect(spec).toContain("demo__esportazione-fatturazione");
		expect(spec).toContain("report-fatturazione-clienti");
		expect(spec).not.toContain("gestione-offerte");
	});

	it("la rotta con parametro corrisponde al template della spec", () => {
		expect(
			specMirate("src/app/(back-office)/offerte/[offertaId]/page.tsx"),
		).toEqual(conFumo("dettaglio-offerta"));
	});

	it("un elenco di percorsi non dipende dalle route che cita", () => {
		// policy-rotte cita la route di esportazione ma non la chiama: modificare
		// la libreria di esportazione non deve passare da lì.
		expect(avvisi("src/lib/policy-rotte.ts")).toEqual([
			"src/lib/policy-rotte.ts non è raggiunto da alcuna rotta",
		]);
	});

	it("un import di soli tipi non crea dipendenza", () => {
		expect(avvisi("src/domain/tariffe/index.ts")).toEqual([
			"src/domain/tariffe/index.ts non è raggiunto da alcuna rotta",
		]);
	});

	it("un modulo condiviso da molte rotte non viene espanso e lo segnala", () => {
		const sorgenti = { ...SORGENTI };
		for (let indice = 0; indice <= SOGLIA_ROTTE_MODULO_CONDIVISO; indice += 1) {
			sorgenti[`src/app/pagina-${indice}/page.tsx`] =
				'import { ore } from "@/domain/consuntivi";';
		}
		const selezione = selezionaSpecE2eMirate({
			fileModificati: ["src/domain/consuntivi/index.ts"],
			contenutoFileSorgente: sorgenti,
			contenutoFileE2e: E2E,
		});
		expect(selezione.modalita).toBe("mirata");
		if (selezione.modalita !== "mirata") return;
		expect(selezione.spec).toEqual(SPEC_SEMPRE_ESEGUITE.toSorted());
		expect(selezione.avvisi).toHaveLength(1);
		expect(selezione.avvisi[0]).toContain("è condiviso da");
	});

	it("un componente condiviso seleziona comunque la spec con il suo nome", () => {
		const sorgenti = { ...SORGENTI };
		for (let indice = 0; indice <= SOGLIA_ROTTE_MODULO_CONDIVISO; indice += 1) {
			sorgenti[`src/app/(back-office)/pagina-${indice}/page.tsx`] = "";
		}
		const selezione = selezionaSpecE2eMirate({
			fileModificati: ["src/app/sidebar-applicazione.tsx"],
			contenutoFileSorgente: sorgenti,
			contenutoFileE2e: E2E,
		});
		expect(selezione.modalita).toBe("mirata");
		if (selezione.modalita !== "mirata") return;
		expect(selezione.spec).toContain("tests/e2e/sidebar.spec.ts");
		expect(selezione.motiviPerSpec["tests/e2e/sidebar.spec.ts"]).toEqual([
			"stesso nome di src/app/sidebar-applicazione.tsx",
		]);
	});

	it("segnala i sorgenti rimossi e quelli che nessuna rotta raggiunge", () => {
		expect(avvisi("src/lib/rimosso.ts", "src/lib/orfano.ts")).toEqual([
			"src/lib/orfano.ts non è raggiunto da alcuna rotta",
			"src/lib/rimosso.ts è stato rimosso: lo coprono i file che lo importavano",
		]);
	});
});

describe("casi che richiedono la suite completa", () => {
	it.each([
		"prisma/schema.prisma",
		"prisma/migrations/20260101_x/migration.sql",
		"playwright.config.ts",
		"package-lock.json",
		"next.config.ts",
		"tests/e2e/global-setup.ts",
		"src/app/layout.tsx",
		"src/app/globals.css",
		"public/logo.svg",
	])("%s incide su tutta l'applicazione", (file) => {
		const selezione = seleziona(file);
		expect(selezione.modalita).toBe("completa");
	});

	it("il proxy e ciò che importa girano a ogni richiesta", () => {
		for (const file of ["src/proxy.ts", "src/lib/sessione.ts"]) {
			const selezione = seleziona(file);
			expect(selezione.modalita).toBe("completa");
			if (selezione.modalita !== "completa") continue;
			expect(selezione.motivi).toEqual([
				`${file} è usato da proxy o instrumentation, eseguiti a ogni richiesta`,
			]);
		}
	});

	it("basta un file globale tra tanti mirati", () => {
		const selezione = seleziona(
			"src/lib/report.ts",
			"prisma/schema.prisma",
			"tests/e2e/gestione-offerte.spec.ts",
		);
		expect(selezione).toEqual({
			modalita: "completa",
			motivi: ["prisma/schema.prisma incide su tutta l'applicazione"],
		});
	});
});
