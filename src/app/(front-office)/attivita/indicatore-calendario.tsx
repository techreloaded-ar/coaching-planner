"use client";

import Link from "next/link";
import { useApriImpostazioni } from "@/app/impostazioni/modale-impostazioni";

/**
 * Stato discreto del connettore Google Calendar: il collegamento si gestisce
 * nella modale Impostazioni, aperta sopra la pagina. L'href resta l'indirizzo
 * delle Impostazioni per l'apertura in una nuova scheda.
 */
export default function IndicatoreCalendario({ collegato }: { collegato: boolean }) {
  const apriImpostazioni = useApriImpostazioni();

  return (
    <Link
      href="/impostazioni/connettori"
      prefetch={false}
      onClick={(evento) => {
        if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return;
        evento.preventDefault();
        apriImpostazioni("connettori");
      }}
      className="inline-flex items-center gap-1.5 text-sm text-testo-metadati transition hover:text-zinc-600 dark:hover:text-zinc-300"
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${collegato ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
      />
      {collegato ? "Google Calendar collegato" : "Google Calendar non collegato"}
    </Link>
  );
}
