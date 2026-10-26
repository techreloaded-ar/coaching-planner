import { redirect } from "next/navigation";
import Image from "next/image";
import { utenteCorrente } from "@/lib/dal";
import { HOME_AUTENTICATA } from "@/lib/policy-rotte";
import AccessoGoogle from "./accesso-google";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ logout?: string; error?: string }>;
}) {
  const sessione = await utenteCorrente();
  if (sessione) {
    redirect(HOME_AUTENTICATA);
  }

  const params = await searchParams;
  const showLogout = params.logout === "1";
  const showError = params.error === "1";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Blob decorativi di sfondo */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50 dark:opacity-20">
        <div className="absolute -left-[140px] -top-[160px] h-[480px] w-[480px] rounded-full bg-gradient-to-br from-emerald-200/60 to-transparent blur-[70px]" />
        <div className="absolute -right-[160px] -bottom-[200px] h-[520px] w-[520px] rounded-full bg-gradient-to-tl from-indigo-200/60 to-transparent blur-[70px]" />
        <div className="absolute right-[14vw] -top-[120px] h-[340px] w-[340px] rounded-full bg-gradient-to-b from-rose-200/50 to-transparent blur-[80px]" />
      </div>

      <main className="relative z-10 flex w-full max-w-[420px] flex-col items-center px-5 py-12 text-center">
        {/* Logo Agile Reloaded su targa bianca */}
        <div className="rounded-[18px] border border-zinc-200 bg-white px-6 py-4 shadow-sm dark:border-white/15 dark:shadow-lg">
          <Image
            src="/agile-reloaded-logo.png"
            alt="Agile Reloaded"
            width={200}
            height={58}
            className="h-[46px] w-auto max-w-full"
            priority
          />
        </div>

        {/* Titolo e filo brand */}
        <h1 className="mt-[26px] text-[38px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
          Coaching Planner
        </h1>
        <div
          aria-hidden="true"
          className="mt-[18px] h-1 w-11 rounded-full bg-gradient-to-r from-teal-600 to-emerald-500"
        />
        <p className="mt-[14px] max-w-[340px] text-base text-zinc-600 dark:text-zinc-400">
          Consuntivi mensili di collaboratori, clienti e offerte.
        </p>

        {/* Messaggio post-logout */}
        {showLogout && (
          <div className="mt-[26px] flex w-full max-w-[340px] items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[13.5px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <svg
              className="mt-0.5 h-[17px] w-[17px] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="12" cy="12" r="9" />
              <path d="m8.5 12.2 2.4 2.4 4.6-5" />
            </svg>
            <span>Ti sei disconnesso. A presto!</span>
          </div>
        )}

        {/* Errore accesso negato */}
        {showError && (
          <div
            className="mt-[26px] flex w-full max-w-[340px] items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13.5px] font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
            role="alert"
          >
            <svg
              className="mt-0.5 h-[17px] w-[17px] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5.2M12 16.4h.01" />
            </svg>
            <span>
              Questo account Google non è autorizzato ad accedere.
            </span>
          </div>
        )}

        {/* Pulsante Accedi con Google */}
        <div className={showLogout || showError ? "mt-4" : "mt-[26px]"}>
          <AccessoGoogle />
        </div>

        {/* Nota a piè di pagina */}
        <p className="mt-[22px] text-xs text-zinc-400 dark:text-zinc-500">
          Area riservata · accesso consentito solo al personale autorizzato
        </p>
      </main>
    </div>
  );
}
