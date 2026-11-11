"use client";

import Link from "next/link";
import { useApriImpostazioni } from "@/app/impostazioni/modale-impostazioni";

/**
 * Stato discreto del connettore Google Calendar, in fondo alla barra del mese:
 * icona del servizio con pallino verde (collegato) o grigio, e tooltip
 * immediato al passaggio del mouse o al focus. Il collegamento si gestisce
 * nella modale Impostazioni, aperta sopra la pagina; l'href resta l'indirizzo
 * delle Impostazioni per l'apertura in una nuova scheda.
 */
export default function IndicatoreCalendario({ collegato }: { collegato: boolean }) {
  const apriImpostazioni = useApriImpostazioni();
  const stato = collegato ? "Google Calendar collegato" : "Google Calendar non collegato";

  return (
    <Link
      href="/impostazioni/connettori"
      prefetch={false}
      aria-label={stato}
      onClick={(evento) => {
        if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return;
        evento.preventDefault();
        apriImpostazioni("connettori");
      }}
      className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 max-sm:h-11 max-sm:w-11 dark:hover:bg-zinc-800"
    >
      {/* Icona stilizzata nei colori di Google Calendar (non l'asset ufficiale). */}
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px]">
        <rect x="2.5" y="3.5" width="19" height="18" rx="3" fill="#fff" stroke="#4285F4" strokeWidth={1.6} />
        <path d="M2.5 6.5a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3V9h-19Z" fill="#4285F4" />
        <path d="M2.5 17h4v4.5h-1a3 3 0 0 1-3-3Z" fill="#FBBC04" />
        <path d="M16 17h5.5v1.5a3 3 0 0 1-3 3H16Z" fill="#34A853" />
        <text x="12" y="18.4" textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#4285F4" fontFamily="Arial, Helvetica, sans-serif">
          31
        </text>
      </svg>
      <span
        aria-hidden="true"
        data-testid="stato-calendario"
        data-collegato={collegato ? "true" : "false"}
        className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--background)] max-sm:bottom-2 max-sm:right-2 ${
          collegato ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-500"
        }`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden whitespace-nowrap rounded-[7px] bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block group-focus-visible:block dark:bg-zinc-700"
      >
        {stato}
      </span>
    </Link>
  );
}
