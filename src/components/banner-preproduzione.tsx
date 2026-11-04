export function BannerPreproduzione() {
  return (
    <aside
      aria-label="Ambiente di preproduzione"
      className="fixed inset-x-0 top-0 z-50 flex h-10 items-center justify-center gap-2.5 border-b border-amber-200 bg-amber-50 px-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 print:hidden"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
      >
        <path d="M9 3h6M10 3v7l-5.2 8.5A2.3 2.3 0 0 0 6.8 22h10.4a2.3 2.3 0 0 0 2-3.5L14 10V3M8 15h8" />
      </svg>
      <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[11px] font-bold tracking-wider dark:bg-amber-800/70">
        PRE-PROD
      </span>
      <span aria-hidden="true" className="text-amber-400 dark:text-amber-600">·</span>
      <span className="text-xs font-medium sm:text-[13px]">Ambiente di prova</span>
    </aside>
  );
}
