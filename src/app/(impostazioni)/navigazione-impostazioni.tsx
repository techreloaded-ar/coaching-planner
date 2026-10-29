"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const CATEGORIE = [
  { href: "/impostazioni/tema", etichetta: "Tema" },
  { href: "/impostazioni/connettori", etichetta: "Connettori" },
] as const;

/** Barra laterale delle Impostazioni: categorie (quella aperta evidenziata) e uscita. */
export default function NavigazioneImpostazioni({
  uscita,
}: {
  uscita: { href: string; etichetta: string };
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-52 shrink-0 flex-col gap-4 max-sm:w-full">
      <nav aria-label="Categorie delle impostazioni" className="flex flex-col gap-0.5">
        {CATEGORIE.map(({ href, etichetta }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className="rounded-[10px] px-3 py-2 text-[13.5px] font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 aria-[current=page]:bg-indigo-50 aria-[current=page]:text-indigo-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:aria-[current=page]:bg-indigo-500/15 dark:aria-[current=page]:text-indigo-400"
          >
            {etichetta}
          </Link>
        ))}
      </nav>
      <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <Link
          href={uscita.href}
          className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {uscita.etichetta}
        </Link>
      </div>
    </aside>
  );
}
