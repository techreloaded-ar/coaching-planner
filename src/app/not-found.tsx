import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--altezza-banner-ambiente))] items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <div className="flex flex-col items-center text-center">
        <p className="text-sm font-medium text-testo-metadati">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-testo-principale">
          Pagina non trovata
        </h1>
        <p className="mt-2 max-w-sm text-sm text-testo-metadati">
          La pagina che stai cercando non esiste o è stata spostata.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-zinc-800 active:translate-y-px dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Torna alla pagina iniziale
        </Link>
      </div>
    </div>
  );
}
