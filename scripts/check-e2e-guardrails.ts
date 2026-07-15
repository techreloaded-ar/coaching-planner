import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const E2E_DIR = path.join(ROOT, "tests", "e2e");

const SEED_EMAIL_ALLOWLIST = new Set([
	"tests/e2e/support/auth.ts",
	"tests/e2e/auth-flows.spec.ts",
	"tests/e2e/demo__accesso-con-google.spec.ts",
	"tests/e2e/autorizzazione-ruoli.spec.ts",
	"tests/e2e/demo__autorizzazione-ruoli.spec.ts",
	"tests/e2e/calendario-segregazione.spec.ts",
	"tests/e2e/demo__calendario-mensile.spec.ts",
	"tests/e2e/anagrafica-collaboratori.spec.ts",
	"tests/e2e/demo__anagrafica-collaboratori.spec.ts",
	"tests/e2e/avanzamento-offerte.spec.ts",
	"tests/e2e/demo__avanzamento-offerte.spec.ts",
	"tests/e2e/accesso-radice.spec.ts",
	"tests/e2e/demo__accesso-diretto-radice.spec.ts",
]);

const XPATH_ALLOWLIST = new Set([
	// US-016 resta read-only sul seed in questa spec; la migrazione dati dedicata
	// è fuori scope e documentata nelle regole e2e.
	"tests/e2e/avanzamento-offerte.spec.ts",
	"tests/e2e/demo__avanzamento-offerte.spec.ts",
]);

const VIDEO_PAUSE_COMMENT = /Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale/;

const FORBIDDEN_PATTERNS: Array<{
	name: string;
	regex: RegExp;
	message: string;
	isAllowed?: (relativePath: string, source: string, index: number) => boolean;
}> = [
	{
		name: "select-option-index",
		regex: /selectOption\s*\(\s*\{\s*index\s*:/g,
		message: "Usa label/value derivati dalla factory, non selectOption({ index }).",
	},
	{
		name: "seed-email",
		regex: /(?:giulia\.conti@agilereloaded\.it|info@techreloaded\.it)/g,
		message: "Le email seed sono ammesse solo in test read-only/di auth esplicitamente allowlistati.",
		isAllowed: (relativePath) => SEED_EMAIL_ALLOWLIST.has(relativePath),
	},
	{
		name: "date-now-scaglioni",
		regex: /Date\.now\s*\(\s*\)\s*%\s*900/g,
		message: "Gli scaglioni km devono usare soglieStabiliInIntervallo e intervalli registrati.",
	},
	{
		name: "fragile-nav-partial",
		regex: /locator\(\s*["']nav\[aria-label=['"]Navigazione principale['"]\]\s+a["']\s*\)[\s\S]{0,140}filter\(\s*\{\s*hasText\s*:/g,
		message: "Ancora la navigazione con getByRole('link', { name, exact: true }).",
	},
	{
		name: "tailwind-class-selector",
		regex: /(?:page\.|\.)locator\(\s*["']\.[^"']*(?:text-|bg-|border-|rounded-|min-w-|max-w-|flex|grid|px-|py-|mt-|mb-)[^"']*["']\s*\)/g,
		message: "Non usare classi Tailwind come contratto primario del test; preferisci ruolo, label o test id.",
	},
	{
		name: "hard-wait",
		regex: /waitForTimeout\s*\(/g,
		message: "waitForTimeout è ammesso solo come pausa finale di video demo con commento esplicito.",
		isAllowed: (_relativePath, source, index) => {
			const before = source.slice(Math.max(0, index - 180), index);
			return VIDEO_PAUSE_COMMENT.test(before);
		},
	},
	{
		name: "xpath-selector",
		regex: /locator\(\s*["']xpath=/g,
		message: "Evita XPath nei test migrati; usa contenitori scoped, ruoli o test id minimi.",
		isAllowed: (relativePath) => XPATH_ALLOWLIST.has(relativePath),
	},
];

type Finding = {
	file: string;
	line: number;
	column: number;
	rule: string;
	message: string;
};

function relative(filePath: string): string {
	return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const fullPath = path.join(dir, entry);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			return walk(fullPath);
		}

		return /\.ts$/.test(entry) ? [fullPath] : [];
	});
}

function position(source: string, index: number): { line: number; column: number } {
	const before = source.slice(0, index);
	const lines = before.split("\n");
	return { line: lines.length, column: lines.at(-1)!.length + 1 };
}

function checkSource(relativePath: string, source: string): Finding[] {
	const findings: Finding[] = [];

	for (const rule of FORBIDDEN_PATTERNS) {
		rule.regex.lastIndex = 0;
		for (const match of source.matchAll(rule.regex)) {
			const index = match.index ?? 0;
			if (rule.isAllowed?.(relativePath, source, index)) {
				continue;
			}

			const { line, column } = position(source, index);
			findings.push({
				file: relativePath,
				line,
				column,
				rule: rule.name,
				message: rule.message,
			});
		}
	}

	return findings;
}

function runSelfTest(): void {
	const cases: Array<{ name: string; source: string; shouldFail: boolean }> = [
		{
			name: "select index vietato",
			source: "await page.locator('#cliente').selectOption({ index: 1 });",
			shouldFail: true,
		},
		{
			name: "hard wait senza commento vietato",
			source: "await page.waitForTimeout(500);",
			shouldFail: true,
		},
		{
			name: "pausa video allowlistata",
			source:
				"// Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.\nawait page.waitForTimeout(1500);",
			shouldFail: false,
		},
		{
			name: "email seed vietata fuori allowlist",
			source: "const email = 'giulia.conti@agilereloaded.it';",
			shouldFail: true,
		},
		{
			name: "scaglione Date.now vietato",
			source: "const km = 9000 + (Date.now() % 900);",
			shouldFail: true,
		},
	];

	for (const testCase of cases) {
		const failed = checkSource("tests/e2e/fake.spec.ts", testCase.source).length > 0;
		if (failed !== testCase.shouldFail) {
			throw new Error(
				`Self-test guardrail fallito: ${testCase.name} (atteso fail=${testCase.shouldFail}, ottenuto fail=${failed})`,
			);
		}
	}

	console.log("✅ Guardrail e2e self-test passed");
}

function main(): void {
	if (process.argv.includes("--self-test")) {
		runSelfTest();
		return;
	}

	const findings = walk(E2E_DIR).flatMap((filePath) =>
		checkSource(relative(filePath), readFileSync(filePath, "utf8")),
	);

	if (findings.length > 0) {
		console.error("❌ Guardrail e2e anti-flakiness falliti:\n");
		for (const finding of findings) {
			console.error(
				`${finding.file}:${finding.line}:${finding.column} [${finding.rule}] ${finding.message}`,
			);
		}
		process.exit(1);
	}

	console.log("✅ Guardrail e2e anti-flakiness passed");
}

main();
