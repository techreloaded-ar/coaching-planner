import Link from "next/link";

/** Interruttore Calendario / Elenco nella barra del mese di `/attivita`. */
export default function InterruttoreVista({
  vista,
  hrefCalendario,
  hrefElenco,
}: {
  vista: "calendario" | "elenco";
  hrefCalendario: string;
  hrefElenco: string;
}) {
  const voci = [
    { chiave: "calendario", etichetta: "Calendario", href: hrefCalendario, icona: "M3 4h18v17H3zM3 9h18M8 2v4M16 2v4" },
    { chiave: "elenco", etichetta: "Elenco", href: hrefElenco, icona: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
  ] as const;

  return (
    <nav
      aria-label="Vista delle attività"
      className="inline-flex rounded-[10px] border border-zinc-200 bg-zinc-100 p-[3px] dark:border-zinc-700 dark:bg-zinc-800"
    >
      {voci.map((voce) => {
        const attiva = voce.chiave === vista;
        return (
          <Link
            key={voce.chiave}
            href={voce.href}
            // Niente prefetch: nel calendario l'href cambia a ogni cambio mese
            // e ogni prefetch sarebbe una richiesta RSC che la cache dei mesi
            // esiste proprio per evitare.
            prefetch={false}
            aria-current={attiva ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-[8px] px-3 py-[5px] max-sm:min-h-11 text-[12.5px] font-semibold transition ${
              attiva
                ? "bg-white text-rose-800 shadow-sm dark:bg-zinc-900 dark:text-rose-300"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[15px] w-[15px]" aria-hidden="true">
              <path d={voce.icona} />
            </svg>
            {voce.etichetta}
          </Link>
        );
      })}
    </nav>
  );
}
