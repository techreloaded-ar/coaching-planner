/**
 * Setup comune del livello integrazione (setupFiles di Vitest).
 *
 * - `next/headers` è simulato: `cookies()` restituisce il token di sessione FIRMATO con la
 *   chiave reale dell'app (`creaTokenSessione`), quindi DAL, guardie di ruolo e verifica
 *   della sessione della consegna girano senza scorciatoie.
 * - Il token è per chiamata (AsyncLocalStorage) per le operazioni contemporanee, con un
 *   valore predefinito per quelle sequenziali.
 * - `redirect`/`notFound`/`forbidden` lanciano come in Next: l'oracolo verifica sempre lo
 *   stato persistito, mai il messaggio.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { vi } from "vitest";

type StatoSessioneOracolo = {
	storage: AsyncLocalStorage<string | null>;
	predefinito: string | null;
	corrente(): string | null;
};

const globale = globalThis as unknown as { __oracoloSessione?: StatoSessioneOracolo };
if (!globale.__oracoloSessione) {
	const storage = new AsyncLocalStorage<string | null>();
	globale.__oracoloSessione = {
		storage,
		predefinito: null,
		corrente() {
			const perChiamata = storage.getStore();
			return perChiamata === undefined ? this.predefinito : perChiamata;
		},
	};
}

vi.mock("next/headers", () => {
	const statoSessione = () => (globalThis as unknown as { __oracoloSessione: StatoSessioneOracolo }).__oracoloSessione;
	return {
		cookies: async () => {
			const token = statoSessione().corrente();
			return {
				get: (name: string) => (token ? { name, value: token } : undefined),
				getAll: () => (token ? [{ name: "sessione", value: token }] : []),
				has: () => Boolean(token),
				set: () => undefined,
				delete: () => undefined,
			};
		},
		headers: async () => new Headers(),
		draftMode: async () => ({ isEnabled: false, enable: () => undefined, disable: () => undefined }),
	};
});

vi.mock("next/cache", () => ({
	revalidatePath: () => undefined,
	revalidateTag: () => undefined,
	updateTag: () => undefined,
	refresh: () => undefined,
	unstable_cache: (fn: unknown) => fn,
	unstable_noStore: () => undefined,
	cacheLife: () => undefined,
	cacheTag: () => undefined,
}));

vi.mock("next/navigation", () => ({
	redirect: (url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	},
	permanentRedirect: (url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	},
	notFound: () => {
		throw new Error("NEXT_NOT_FOUND");
	},
	forbidden: () => {
		throw new Error("NEXT_FORBIDDEN");
	},
	unauthorized: () => {
		throw new Error("NEXT_UNAUTHORIZED");
	},
	useRouter: () => ({}),
	usePathname: () => "/",
	useSearchParams: () => new URLSearchParams(),
}));
