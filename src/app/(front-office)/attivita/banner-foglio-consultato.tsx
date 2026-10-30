import Link from "next/link";
import type { Collaboratore } from "@/generated/prisma/client";

/**
 * Avviso mostrato quando un amministratore consulta il foglio attività di un
 * collaboratore: ricorda a nome di chi verranno registrate le modifiche, o che
 * il foglio è in sola lettura, e riporta alla scheda del collaboratore.
 */
export default function BannerFoglioConsultato({
  collaboratore,
}: {
  collaboratore: Pick<Collaboratore, "id" | "nome" | "cognome" | "attivo">;
}) {
  const nomeCompleto = `${collaboratore.nome} ${collaboratore.cognome}`;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-8 pt-4 max-md:px-4">
      <div
        role="status"
        data-testid="banner-foglio-consultato"
        className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <span>
          Stai consultando il foglio di <strong>{nomeCompleto}</strong>.{" "}
          {collaboratore.attivo
            ? "Le modifiche saranno registrate a suo nome."
            : "Il collaboratore è disattivato: il foglio è in sola lettura."}
        </span>
        <Link
          href={`/anagrafiche/collaboratori/${collaboratore.id}`}
          className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Torna alla scheda
        </Link>
      </div>
    </div>
  );
}
