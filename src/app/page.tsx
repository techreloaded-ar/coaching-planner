import { redirect } from "next/navigation";
import { utenteCorrente } from "@/lib/dal";
import { homePerRuolo } from "@/lib/policy-rotte";

export default async function Home() {
  const sessione = await utenteCorrente();
  if (sessione) {
    redirect(homePerRuolo(sessione.ruolo));
  }

  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Blob decorativi di sfondo */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50 dark:opacity-20">
        <div className="absolute -left-[140px] -top-[160px] h-[480px] w-[480px] rounded-full bg-gradient-to-br from-emerald-200/60 to-transparent blur-[70px]" />
        <div className="absolute -right-[160px] -bottom-[200px] h-[520px] w-[520px] rounded-full bg-gradient-to-tl from-indigo-200/60 to-transparent blur-[70px]" />
        <div className="absolute right-[14vw] -top-[120px] h-[340px] w-[340px] rounded-full bg-gradient-to-b from-rose-200/50 to-transparent blur-[80px]" />
      </div>

      <main className="relative z-10 flex w-full max-w-lg flex-col items-center px-6 py-12 text-center">
        {/* Badge brand */}
        <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[15px] bg-gradient-to-br from-teal-600 to-emerald-500 text-[26px] font-extrabold text-white shadow-md">
          CP
        </div>

        <h1 className="mt-7 text-4xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-5xl">
          Coaching Planner
        </h1>

        <p className="mt-4 max-w-md text-base text-zinc-500 dark:text-zinc-400 sm:text-lg">
          Consuntivi mensili di collaboratori, clienti e offerte.
        </p>

        <a
          href="/login"
          className="mt-9 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 active:translate-y-px dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Accedi
        </a>
      </main>
    </div>
  );
}
