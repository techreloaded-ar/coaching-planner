/**
 * Criteri di calcolo di un report, chiusi in fondo alla pagina. `<details>`
 * nativo: si apre con Invio o Spazio e resta nella sequenza di tabulazione.
 */
export function ComeVieneCalcolato({ children }: { children: React.ReactNode }) {
  return (
    <details className="group mt-8 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg text-sm font-medium text-testo-principale transition-colors hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500 dark:hover:text-indigo-400 [&::-webkit-details-marker]:hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-4 w-4 text-testo-metadati transition-transform group-open:rotate-90"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
        Come viene calcolato
      </summary>
      <ul className="mt-3 flex max-w-[720px] list-disc flex-col gap-2 pl-10 text-sm leading-relaxed text-testo-secondario">
        {children}
      </ul>
    </details>
  );
}
