import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import SceltaUtente from "./scelta-utente";

/**
 * /e2e-test/scegli-utente
 *
 * Login simulato delle anteprime: elenca gli utenti che il login reale
 * accetterebbe e crea la sessione dell'utente scelto tramite
 * /api/e2e-test/sessione. Esiste solo con E2E_TEST_MODE=true, altrimenti 404.
 */
export default async function ScegliUtentePage() {
  // Letta a ogni richiesta: la build non deve congelare l'esito della modalità.
  await connection();
  if (process.env.E2E_TEST_MODE !== "true") {
    notFound();
  }

  // Stessi esclusi del callback del login reale: utenti disattivati e
  // collaboratori con profilo disattivato.
  const utenti = await db.utente.findMany({
    where: {
      attivo: true,
      NOT: { ruolo: "COLLABORATORE", collaboratore: { is: { attivo: false } } },
    },
    select: {
      email: true,
      nome: true,
      cognome: true,
      ruolo: true,
      collaboratore: { select: { id: true } },
    },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });

  return (
    <main className="mx-auto w-full max-w-[560px] px-5 py-12">
      <h1 className="text-[26px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
        Scegli l&apos;utente
      </h1>
      <p className="mt-2 text-[13.5px] text-zinc-600 dark:text-zinc-400">
        Accesso simulato: Google non è contattato. Entri come l&apos;utente scelto,
        con i suoi permessi.
      </p>
      <SceltaUtente
        utenti={utenti.map((utente) => ({
          email: utente.email,
          nomeCompleto: `${utente.nome} ${utente.cognome}`,
          profili: [
            utente.ruolo === "AMMINISTRATORE" ? "Amministratore" : "Collaboratore",
            ...(utente.ruolo === "AMMINISTRATORE" && utente.collaboratore
              ? ["profilo collaboratore"]
              : []),
          ].join(" · "),
        }))}
      />
    </main>
  );
}
