import { notFound } from "next/navigation";
import {
  PERCORSO_CALLBACK_CALENDARIO,
  PREFISSO_CODICE_CONSENSO_E2E,
} from "@/lib/calendario-google";
import ConsensoSimulato from "./consenso-simulato";

/**
 * /e2e-test/consenso-calendario?state=…&login_hint=…
 *
 * Consenso Google Calendar simulato delle anteprime: si sceglie quale account
 * «autorizzare» (quello di accesso o un altro) oppure si nega il consenso, e si
 * torna al callback reale con il codice simulato `e2e-consenso:<email>`.
 * Esiste solo con E2E_TEST_MODE=true, altrimenti 404.
 */
export default async function ConsensoCalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; login_hint?: string }>;
}) {
  const { state = "", login_hint: emailAccesso = "" } = await searchParams;
  if (process.env.E2E_TEST_MODE !== "true") {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 py-12">
      <h1 className="text-[26px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
        Scegli l&apos;account Google
      </h1>
      <p className="mt-2 text-[13.5px] text-zinc-600 dark:text-zinc-400">
        Consenso simulato: Google non è contattato. Scegli quale account
        autorizzare alla lettura del calendario.
      </p>
      <ConsensoSimulato
        state={state}
        emailAccesso={emailAccesso}
        percorsoCallback={PERCORSO_CALLBACK_CALENDARIO}
        prefissoCodice={PREFISSO_CODICE_CONSENSO_E2E}
      />
    </main>
  );
}
