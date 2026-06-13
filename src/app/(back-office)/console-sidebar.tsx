"use client";

import { usePathname } from "next/navigation";

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

const IconScaglioni = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" />
  </svg>
);

const IconReport = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9}>
    <path d="M3 3v18h18" /><path d="M7.5 15.5v-4M12 15.5V7.5M16.5 15.5v-6" />
  </svg>
);

const IconEsci = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2}>
    <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="m16 17 5-5-5-5M21 12H9" />
  </svg>
);

// ── Dati di navigazione ────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/anagrafiche/clienti", label: "Clienti", icon: IconClienti },
  { label: "Offerte", icon: IconOfferte, disabled: true },
  { href: "/anagrafiche/collaboratori", label: "Collaboratori", icon: IconCollaboratori },
  { label: "Scaglioni km", icon: IconScaglioni, disabled: true },
  { label: "Report", icon: IconReport, disabled: true },
] as const;

// ── Props ──────────────────────────────────────────────────────

interface SidebarProps {
  nome: string;
  ruolo: string;
  iniziali: string;
}

// ── Componente ─────────────────────────────────────────────────

export default function ConsoleSidebar({ nome, ruolo, iniziali }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-[248px] flex-col border-r border-zinc-200 bg-white transition-colors dark:border-zinc-800 dark:bg-zinc-900 max-[920px]:w-[66px]">
      {/* Brand */}
      <div className="flex items-center gap-[11px] border-b border-zinc-100 px-4 py-[18px] dark:border-zinc-800 max-[920px]:justify-center max-[920px]:px-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-indigo-500 to-indigo-600 text-[13px] font-extrabold text-white shadow-sm">
          CP
        </div>
        <div className="min-w-0 leading-[1.25] max-[920px]:hidden">
          <b className="block text-[14px] font-bold tracking-tight whitespace-nowrap text-zinc-800 dark:text-zinc-100">
            Coaching Planner
          </b>
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
            Console gestionale
          </span>
        </div>
      </div>

      {/* Navigazione */}
      <nav className="flex flex-1 flex-col gap-[3px] overflow-y-auto px-[10px] py-[14px]" aria-label="Navigazione principale">
        <span className="px-[10px] pb-[7px] pt-1 text-[10.5px] font-bold uppercase tracking-[.09em] text-zinc-400 dark:text-zinc-500 max-[920px]:hidden">
          Gestione
        </span>

        {NAV_ITEMS.map((item) => {
          const isActive = "href" in item ? pathname.startsWith(item.href!) : false;

          if ("disabled" in item && item.disabled) {
            return (
              <button
                key={item.label}
                type="button"
                disabled
                aria-disabled="true"
                title={`${item.label} — In arrivo`}
                className="relative flex w-full cursor-not-allowed items-center gap-[11px] rounded-[10px] border-0 bg-transparent px-[11px] py-[9px] text-left font-[inherit] text-[13.5px] font-semibold text-zinc-400 dark:text-zinc-500 max-[920px]:justify-center max-[920px]:px-[10px]"
              >
                {item.icon}
                <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap max-[920px]:hidden">
                  {item.label}
                </span>
                <span className="shrink-0 rounded-full bg-amber-50 px-[7px] py-[2px] text-[10px] font-bold tracking-[.03em] whitespace-nowrap text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 max-[920px]:hidden">
                  In arrivo
                </span>
              </button>
            );
          }

          return (
            <a
              key={item.label}
              href={"href" in item ? item.href : undefined}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[13.5px] font-semibold no-underline transition-colors max-[920px]:justify-center max-[920px]:px-[10px] ${
                isActive
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
            >
              {isActive && (
                <span className="absolute -left-[10px] top-2 bottom-2 w-[3px] rounded-full bg-indigo-500 dark:bg-indigo-400" />
              )}
              {item.icon}
              <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap max-[920px]:hidden">
                {item.label}
              </span>
            </a>
          );
        })}
      </nav>

      {/* Piede sidebar */}
      <div className="flex flex-col gap-[10px] border-t border-zinc-100 p-3 dark:border-zinc-800 max-[920px]:items-center max-[920px]:p-[10px]">
        <div className="flex items-center gap-[10px] px-[3px] py-[2px] max-[920px]:flex-col max-[920px]:gap-2 max-[920px]:p-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[13px] font-bold text-white">
            {iniziali}
          </div>
          <div className="min-w-0 flex-1 leading-[1.25] max-[920px]:hidden">
            <b className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">
              {nome}
            </b>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {ruolo}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const el = document.querySelector<HTMLButtonElement>('[data-esci]');
            el?.click();
          }}
          className="inline-flex w-full items-center justify-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750 max-[920px]:w-auto max-[920px]:px-[8px]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2}>
            <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="m16 17 5-5-5-5M21 12H9" />
          </svg>
          <span className="max-[920px]:hidden">Esci</span>
        </button>
      </div>
    </aside>
  );
}
