"use client";

import { usePathname } from "next/navigation";

/** Titolo dell'intestazione del front office, coerente con l'area aperta. */
export default function TitoloFrontOffice() {
  const titolo = usePathname().startsWith("/impostazioni") ? "Impostazioni" : "Le mie attività";

  return (
    <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
      {titolo}
    </h1>
  );
}
