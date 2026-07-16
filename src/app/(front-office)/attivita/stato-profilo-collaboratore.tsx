import Link from "next/link";

interface StatoProfiloCollaboratoreProps {
  stato: "ASSENTE" | "DISATTIVATO";
  amministratore: boolean;
}

/**
 * Stato condiviso delle pagine front office quando l'utente autenticato non
 * dispone di un profilo Collaboratore utilizzabile.
 */
export default function StatoProfiloCollaboratore({
  stato,
  amministratore,
}: StatoProfiloCollaboratoreProps) {
  const profiloAssente = stato === "ASSENTE";

  return (
    <section
      className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-8 py-16"
      aria-labelledby="titolo-stato-profilo"
    >
      <div className="rounded-full bg-amber-100 p-3 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-6 w-6"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.2M12 16.4h.01" />
        </svg>
      </div>
      <div>
        <h2
          id="titolo-stato-profilo"
          className="text-xl font-bold text-zinc-800 dark:text-zinc-100"
        >
          Attività non disponibili
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {profiloAssente
            ? "Il tuo account non è collegato a un profilo Collaboratore. Per registrare e consultare le attività, richiedi il censimento nell'Anagrafica collaboratori."
            : "Il tuo profilo Collaboratore è disattivato. Non puoi registrare o consultare attività finché non viene riattivato."}
        </p>
      </div>
      {amministratore && (
        <Link
          href="/anagrafiche/collaboratori"
          className="inline-flex rounded-[10px] bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Apri Anagrafica collaboratori
        </Link>
      )}
    </section>
  );
}
