import Link from "next/link";
import { MESSAGGIO_ULTIMO_AMMINISTRATORE } from "@/domain/anagrafiche/protezione-amministratore";
import { richiediRuolo } from "@/lib/dal";
import { elencaUtenti } from "@/lib/utenti";
import UtentiTabella from "./utenti-tabella";

interface UtentiPageProps {
  searchParams: Promise<{ esito?: string; errore?: string }>;
}

export default async function UtentiPage({ searchParams }: UtentiPageProps) {
  await richiediRuolo("AMMINISTRATORE");
  const utenti = await elencaUtenti();
  const { esito, errore } = await searchParams;

  const messaggioEsito =
    esito === "creato"
      ? "Utente censito: può accedere all'applicazione con il suo account Google"
      : esito === "salvato"
        ? "Modifiche all'utente salvate"
        : esito === "invalidato"
          ? "Utente invalidato: l'accesso è revocato e il record resta in elenco"
          : esito === "riattivato"
            ? "Utente riattivato: può accedere di nuovo all'applicazione"
            : null;
  const erroreUltimoAmministratore = errore === "ultimo-amministratore";

  return (
    <div>
      {messaggioEsito && (
        <div
          role="status"
          className="mb-[18px] flex items-start gap-[11px] rounded-[11px] border border-emerald-200 bg-emerald-50 p-[15px] text-[13px] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="mt-[2px] h-4 w-4 shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12.5 2.5 2.5 5-5" />
          </svg>
          <span>{messaggioEsito}</span>
        </div>
      )}

      {erroreUltimoAmministratore && (
        <div
          role="alert"
          className="mb-[18px] flex items-start gap-[9px] rounded-[11px] border border-red-200 bg-red-50 px-[13px] py-[11px] text-[13px] font-semibold leading-[1.45] text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="mt-[1.5px] h-4 w-4 shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path d="M12 9v4.5M12 17h.01" />
            <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          <span>{MESSAGGIO_ULTIMO_AMMINISTRATORE}</span>
        </div>
      )}

      <div className="mb-[22px] flex flex-wrap items-start gap-[18px]">
        <div className="min-w-0 flex-1">
          <div className="mb-[5px] text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
            Amministrazione
          </div>
          <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            Utenti
          </h1>
          <p className="mt-[7px] max-w-[580px] text-[13px] leading-[1.55] text-zinc-400 dark:text-zinc-500">
            Chi può accedere all&apos;applicazione. Da qui censisci nuovi utenti e ne aggiorni i dati anagrafici,
            senza interventi manuali sul database.
          </p>
        </div>
        <div className="shrink-0 pt-0.5 max-[640px]:w-full">
          <Link
            href="/anagrafiche/utenti/nuovo"
            className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[15px] py-[9px] text-[13.5px] font-semibold text-white shadow-sm no-underline transition hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 max-[640px]:w-full max-[640px]:justify-center"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="h-4 w-4"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nuovo utente
          </Link>
        </div>
      </div>

      <UtentiTabella utenti={utenti} />
    </div>
  );
}
