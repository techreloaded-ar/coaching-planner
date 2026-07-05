import { randomUUID } from "node:crypto";

import type {
	Cliente,
	Collaboratore,
	Offerta,
	RigaAttivita,
	Ruolo,
	ScaglioneKm,
	Utente,
} from "../../../src/generated/prisma/client";

import { e2ePrisma, type E2ePrismaClient } from "./prisma";

export type CollaboratoreTestData = {
	utente: Utente;
	collaboratore: Collaboratore;
};

export type ClienteConOffertaTestData = {
	cliente: Cliente;
	offerta: Offerta;
};

export type CreateUtenteOptions = {
	nome?: string;
	email?: string;
	ruolo?: Ruolo;
};

export type CreateCollaboratoreOptions = {
	utente?: Utente;
	utenteOptions?: CreateUtenteOptions;
	nome?: string;
	cognome?: string;
	partitaIva?: string;
	tariffaGiornaliera?: string | number;
	attivo?: boolean;
};

export type CreateClienteOptions = {
	ragioneSociale?: string;
	partitaIva?: string | null;
	codiceFiscale?: string | null;
	indirizzo?: string | null;
	citta?: string | null;
	cap?: string | null;
	provincia?: string | null;
	pec?: string | null;
	codiceDestinatario?: string | null;
	attivo?: boolean;
};

export type CreateOffertaOptions = {
	cliente?: Cliente;
	codice?: string;
	descrizione?: string;
	tariffaGiornaliera?: string | number;
	giorniPrevisti?: number;
	attiva?: boolean;
};

export type CreateRigaAttivitaOptions = {
	collaboratore?: Collaboratore | CollaboratoreTestData;
	cliente?: Cliente;
	offerta?: Offerta;
	data?: Date;
	ore?: string | number;
	nota?: string | null;
	fatturabile?: boolean;
	trasfertaKm?: number | null;
};

export type CreateScaglioneKmOptions = {
	finoAKm: number;
	importo: string | number;
};

function slugify(value: string): string {
	return value
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);
}

function hashToNumericCode(value: string): string {
	let hash = 0;

	for (const character of value) {
		hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
	}

	return hash.toString().padStart(11, "0").slice(-11);
}

function resolveCollaboratoreId(
	collaboratore: Collaboratore | CollaboratoreTestData,
): string {
	return "collaboratore" in collaboratore
		? collaboratore.collaboratore.id
		: collaboratore.id;
}

async function insertReturning<T extends pg.QueryResultRow>(
	client: E2ePrismaClient,
	query: string,
	values: unknown[],
): Promise<T> {
	const result = await client.query<T>(query, values);
	const row = result.rows[0];

	if (!row) {
		throw new Error("Inserimento fixture e2e senza riga di ritorno");
	}

	return row;
}

import type pg from "pg";

/**
 * Factory for isolated e2e rows.
 *
 * The ordinary cleanup happens once in globalTeardown. Factories must not delete
 * data while Playwright workers are running: isolation is provided by readable
 * namespaces and by each test owning its own related rows.
 */
export class E2eDataFactory {
	private sequence = 0;

	constructor(
		public readonly namespace: string,
		public readonly prisma: E2ePrismaClient = e2ePrisma,
	) {}

	async createUtente(options: CreateUtenteOptions = {}): Promise<Utente> {
		const token = this.nextToken("utente");
		const readableName = this.readableName(token);
		const now = new Date();

		return insertReturning<Utente>(
			this.prisma,
			`INSERT INTO "Utente" ("id", "nome", "email", "ruolo", "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4::"Ruolo", $5, $5)
			 RETURNING *`,
			[
				randomUUID(),
				options.nome ?? `E2E ${readableName}`,
				options.email ?? `${token}@e2e.invalid`,
				options.ruolo ?? "COLLABORATORE",
				now,
			],
		);
	}

	async createCollaboratore(
		options: CreateCollaboratoreOptions = {},
	): Promise<CollaboratoreTestData> {
		const token = this.nextToken("collaboratore");
		const utente =
			options.utente ??
			(await this.createUtente({
				...options.utenteOptions,
				nome: options.utenteOptions?.nome ?? `E2E ${this.readableName(token)}`,
				ruolo: options.utenteOptions?.ruolo ?? "COLLABORATORE",
			}));
		const now = new Date();

		const collaboratore = await insertReturning<Collaboratore>(
			this.prisma,
			`INSERT INTO "Collaboratore" ("id", "userId", "nome", "cognome", "partitaIva", "tariffaGiornaliera", "attivo", "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
			 RETURNING *`,
			[
				randomUUID(),
				utente.id,
				options.nome ?? "E2E",
				options.cognome ?? this.readableName(token),
				options.partitaIva ?? this.numericCode(`partita-iva-${token}`),
				options.tariffaGiornaliera ?? "350.00",
				options.attivo ?? true,
				now,
			],
		);

		return { utente, collaboratore };
	}

	async createCliente(options: CreateClienteOptions = {}): Promise<Cliente> {
		const token = this.nextToken("cliente");
		const readableName = this.readableName(token);
		const now = new Date();

		return insertReturning<Cliente>(
			this.prisma,
			`INSERT INTO "Cliente" ("id", "ragioneSociale", "partitaIva", "codiceFiscale", "indirizzo", "citta", "cap", "provincia", "pec", "codiceDestinatario", "attivo", "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
			 RETURNING *`,
			[
				randomUUID(),
				options.ragioneSociale ?? `E2E Cliente ${readableName}`,
				options.partitaIva === undefined
					? this.numericCode(`cliente-piva-${token}`)
					: options.partitaIva,
				options.codiceFiscale === undefined ? null : options.codiceFiscale,
				options.indirizzo ?? "Via E2E 1",
				options.citta ?? "Torino",
				options.cap ?? "10100",
				options.provincia ?? "TO",
				options.pec ?? `${token}@pec.e2e.invalid`,
				options.codiceDestinatario ??
					`E${this.numericCode(`cliente-sdi-${token}`).slice(0, 6)}`,
				options.attivo ?? true,
				now,
			],
		);
	}

	async createOfferta(options: CreateOffertaOptions = {}): Promise<Offerta> {
		const token = this.nextToken("offerta");
		const cliente = options.cliente ?? (await this.createCliente());
		const now = new Date();

		return insertReturning<Offerta>(
			this.prisma,
			`INSERT INTO "Offerta" ("id", "codice", "descrizione", "clienteId", "tariffaGiornaliera", "giorniPrevisti", "attiva", "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
			 RETURNING *`,
			[
				randomUUID(),
				options.codice ?? `E2E-${token.toUpperCase()}`,
				options.descrizione ?? `Offerta e2e ${this.readableName(token)}`,
				cliente.id,
				options.tariffaGiornaliera ?? "500.00",
				options.giorniPrevisti ?? 10,
				options.attiva ?? true,
				now,
			],
		);
	}

	async createClienteConOfferta(
		clienteOptions: CreateClienteOptions = {},
		offertaOptions: Omit<CreateOffertaOptions, "cliente"> = {},
	): Promise<ClienteConOffertaTestData> {
		const cliente = await this.createCliente(clienteOptions);
		const offerta = await this.createOfferta({ ...offertaOptions, cliente });

		return { cliente, offerta };
	}

	async createRigaAttivita(
		options: CreateRigaAttivitaOptions = {},
	): Promise<RigaAttivita> {
		const collaboratore =
			options.collaboratore ?? (await this.createCollaboratore());
		const offerta = options.offerta ?? (await this.createOfferta());
		const clienteId = options.cliente?.id ?? offerta.clienteId;
		const now = new Date();

		return insertReturning<RigaAttivita>(
			this.prisma,
			`INSERT INTO "RigaAttivita" ("id", "collaboratoreId", "clienteId", "offertaId", "data", "ore", "nota", "fatturabile", "trasfertaKm", "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
			 RETURNING *`,
			[
				randomUUID(),
				resolveCollaboratoreId(collaboratore),
				clienteId,
				offerta.id,
				options.data ?? new Date("2026-01-15T00:00:00.000Z"),
				options.ore ?? "8.00",
				options.nota === undefined
					? `Riga e2e ${this.namespace}`
					: options.nota,
				options.fatturabile ?? true,
				options.trasfertaKm,
				now,
			],
		);
	}

	async createScaglioneKm(
		options: CreateScaglioneKmOptions,
	): Promise<ScaglioneKm> {
		const now = new Date();

		return insertReturning<ScaglioneKm>(
			this.prisma,
			`INSERT INTO "ScaglioneKm" ("id", "finoAKm", "importo", "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $4)
			 RETURNING *`,
			[randomUUID(), options.finoAKm, options.importo, now],
		);
	}

	private nextToken(label: string): string {
		this.sequence += 1;
		return slugify(
			`${this.namespace}-${label}-${String(this.sequence).padStart(3, "0")}`,
		);
	}

	private readableName(token: string): string {
		return token
			.split("-")
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" ");
	}

	private numericCode(value: string): string {
		return hashToNumericCode(`${this.namespace}-${value}`);
	}
}

export function createE2eDataFactory(namespace: string): E2eDataFactory {
	return new E2eDataFactory(namespace);
}
