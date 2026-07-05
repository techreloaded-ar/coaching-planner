import { test as base, expect, type TestInfo } from "@playwright/test";
import path from "node:path";

import {
	createE2eDataFactory,
	type ClienteConOffertaTestData,
	type CollaboratoreTestData,
	type E2eDataFactory,
} from "./factory";

type E2eFixtures = {
	namespace: string;
	factory: E2eDataFactory;
	collaboratore: CollaboratoreTestData;
	clienteConOfferta: ClienteConOffertaTestData;
};

function slugify(value: string): string {
	return value
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

function stableHash(value: string): string {
	let hash = 5381;

	for (const character of value) {
		hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
	}

	return (hash >>> 0).toString(36);
}

function titlePathFromTestInfo(testInfo: TestInfo): string[] {
	const maybeTitlePath = (
		testInfo as TestInfo & { titlePath?: string[] | (() => string[]) }
	).titlePath;

	if (typeof maybeTitlePath === "function") {
		return maybeTitlePath();
	}

	if (Array.isArray(maybeTitlePath)) {
		return maybeTitlePath;
	}

	return [testInfo.title];
}

export function namespaceFromTestInfo(testInfo: TestInfo): string {
	const file = path.relative(process.cwd(), testInfo.file);
	const rawNamespace = [
		testInfo.project.name,
		file,
		...titlePathFromTestInfo(testInfo),
		`retry-${testInfo.retry}`,
		`repeat-${testInfo.repeatEachIndex}`,
		`parallel-${testInfo.parallelIndex}`,
	].join(" ");
	const readable = slugify(rawNamespace) || "test";

	return `e2e-${readable}-${stableHash(rawNamespace)}`;
}

/**
 * Shared Playwright fixture for isolated database rows.
 *
 * It does not perform per-test deletes because tests can run concurrently.
 * Ordinary cleanup is centralized in globalTeardown; isolation comes from the
 * namespace derived from testInfo and from each fixture creating its own related
 * Collaboratore, Cliente, Offerta and RigaAttivita rows.
 */
export const test = base.extend<E2eFixtures>({
	namespace: async ({}, run, testInfo) => {
		await run(namespaceFromTestInfo(testInfo));
	},
	factory: async ({ namespace }, run) => {
		await run(createE2eDataFactory(namespace));
	},
	collaboratore: async ({ factory }, run) => {
		await run(await factory.createCollaboratore());
	},
	clienteConOfferta: async ({ factory }, run) => {
		await run(await factory.createClienteConOfferta());
	},
});

export { expect };
export type { ClienteConOffertaTestData, CollaboratoreTestData, E2eDataFactory };
