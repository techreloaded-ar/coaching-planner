"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoCoachingPlanner } from "@/components/logo-coaching-planner";

// ── Icone SVG inline ───────────────────────────────────────────

const IconClienti = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9}>
    <path d="M3 21V8.5L9 4l6 4.5V21" /><path d="M15 21h6V11l-6-3" />
    <path d="M7.5 21v-4.5h3V21" /><path d="M7 9.5h.01M11 9.5h.01M7 13h.01M11 13h.01" />
  </svg>
);

const IconOfferte = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9}>
    <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M14 3v6h6M8 13h8M8 17h5" />
  </svg>
);

const IconCollaboratori = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9}>
    <circle cx="9" cy="8" r="3.4" /><path d="M2.8 19.4a6.2 6.2 0 0 1 12.4 0" />
    <circle cx="17.2" cy="9.4" r="2.6" /><path d="M15.4 14.6a5 5 0 0 1 5.8 4.8" />
  </svg>
);

const IconVociRimborso = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" />
  </svg>
);

const IconReport = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9}>
    <path d="M3 3v18h18" /><path d="M7.5 15.5v-4M12 15.5V7.5M16.5 15.5v-6" />
  </svg>
);

const IconAttivita = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9}>
    <path d="M8 3v3M16 3v3M4 10h16M5 6h14a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1Z" />
    <path d="m8 15 2.5 2.5L16 12" />
  </svg>
);

const IconRigheSospese = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9}>
    <path d="M12 3 2.5 19.5h19L12 3Z" /><path d="M12 10v4.5M12 17.2h.01" />
  </svg>
);

// ── Dati di navigazione ────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/anagrafiche/clienti", label: "Clienti", icon: IconClienti },
  { href: "/offerte", label: "Offerte", icon: IconOfferte },
  { href: "/anagrafiche/persone", label: "Persone", icon: IconCollaboratori },
  { href: "/anagrafiche/voci-rimborso", label: "Voci di rimborso", icon: IconVociRimborso },
  { href: "/report/fatturazione-clienti", label: "Fatturazione clienti", icon: IconReport },
  { href: "/report/fatturazione-collaboratori", label: "Fatturazione collaboratori", icon: IconReport },
  { href: "/report/marginalita", label: "Marginalità", icon: IconReport },
  { href: "/importazione", label: "Importazione", icon: IconRigheSospese },
] as const;

// ── Componenti ─────────────────────────────────────────────────

const CLASSI_LINK_ATTIVO = "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400";
const CLASSI_LINK_INATTIVO =
  "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

/** Marchio della console: logo, nome del prodotto e area. */
function BrandConsole() {
  return (
    <div className="flex min-w-0 items-center gap-[11px]">
      <LogoCoachingPlanner mostraNome={false} />
      <div className="min-w-0 leading-[1.25]">
        <b className="block text-[14px] font-bold tracking-tight whitespace-nowrap text-zinc-800 dark:text-zinc-100">
          Coaching Planner
        </b>
        <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
          Amministrazione
        </span>
      </div>
    </div>
  );
}

/** Link della console, condivisi da sidebar desktop e menu apribile. */
function NavigazioneConsole({ suNavigazione }: { suNavigazione?: () => void }) {
  const pathname = usePathname();
  const attivitaAttiva = pathname === "/attivita" || pathname.startsWith("/attivita/");

  return (
    <nav className="flex flex-1 flex-col gap-[3px] overflow-y-auto px-[10px] py-[14px]" aria-label="Navigazione principale">
      <Link
        href="/attivita"
        onClick={suNavigazione}
        aria-current={attivitaAttiva ? "page" : undefined}
        className={`relative flex items-center gap-[11px] max-[920px]:min-h-11 rounded-[10px] px-[11px] py-[9px] text-[13.5px] font-semibold no-underline transition-colors ${
          attivitaAttiva ? CLASSI_LINK_ATTIVO : CLASSI_LINK_INATTIVO
        }`}
      >
        {IconAttivita}
        <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          Le mie attività
        </span>
      </Link>

      <span className="px-[10px] pb-[7px] pt-4 text-[10.5px] font-bold uppercase tracking-[.09em] text-zinc-400 dark:text-zinc-500">
        Gestione
      </span>

      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <a
            key={item.label}
            href={item.href}
            onClick={suNavigazione}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex items-center gap-[11px] max-[920px]:min-h-11 rounded-[10px] px-[11px] py-[9px] text-[13.5px] font-semibold no-underline transition-colors ${
              isActive ? CLASSI_LINK_ATTIVO : CLASSI_LINK_INATTIVO
            }`}
          >
            {isActive && (
              <span className="absolute -left-[10px] top-2 bottom-2 w-[3px] rounded-full bg-indigo-500 dark:bg-indigo-400" />
            )}
            {item.icon}
            <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {item.label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}

/** Sidebar fissa, da 920 px in su. */
export default function ConsoleSidebar() {
  return (
    <aside className="fixed bottom-0 top-[var(--altezza-banner-ambiente)] left-0 z-20 flex w-[248px] flex-col border-r border-zinc-200 bg-white transition-colors dark:border-zinc-800 dark:bg-zinc-900 max-[920px]:hidden">
      <div className="border-b border-zinc-100 px-4 py-[18px] dark:border-zinc-800">
        <BrandConsole />
      </div>
      <NavigazioneConsole />
    </aside>
  );
}

/**
 * Sotto 920 px la sidebar diventa un menu apribile dall'intestazione.
 * Il `<dialog>` modale rende inerte il resto della pagina, chiude con Escape
 * e alla chiusura riporta il focus sul pulsante che l'ha aperto.
 */
export function MenuConsoleMobile() {
  const riferimentoDialog = useRef<HTMLDialogElement>(null);
  const [aperto, setAperto] = useState(false);

  function apri() {
    riferimentoDialog.current?.showModal();
    setAperto(true);
  }

  function chiudi() {
    riferimentoDialog.current?.close();
  }

  return (
    <div className="mr-auto flex items-center gap-3 min-[920px]:hidden">
      <button
        type="button"
        onClick={apri}
        aria-label="Apri menu di navigazione"
        aria-haspopup="dialog"
        aria-expanded={aperto}
        aria-controls="menu-navigazione-console"
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750 dark:hover:text-zinc-100"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <LogoCoachingPlanner mostraNome={false} />

      <dialog
        id="menu-navigazione-console"
        ref={riferimentoDialog}
        aria-label="Menu di navigazione"
        onClose={() => setAperto(false)}
        // Il tocco sullo sfondo arriva al dialog stesso, non al suo contenuto.
        onClick={(evento) => {
          if (evento.target === evento.currentTarget) chiudi();
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[290px] max-w-[85vw] border-r border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-zinc-900/40 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 py-2.5 pl-4 pr-2.5 dark:border-zinc-800">
            <BrandConsole />
            <button
              type="button"
              onClick={chiudi}
              aria-label="Chiudi menu di navigazione"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <NavigazioneConsole suNavigazione={chiudi} />
        </div>
      </dialog>
    </div>
  );
}
