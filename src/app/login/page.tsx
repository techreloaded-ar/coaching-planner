"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const searchParams = useSearchParams();
  const showLogout = searchParams.get("logout") === "1";
  const showError = searchParams.get("error") === "1";
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = () => {
    setLoading(true);
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Blob decorativi di sfondo */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50 dark:opacity-20">
        <div className="absolute -left-[140px] -top-[160px] h-[480px] w-[480px] rounded-full bg-gradient-to-br from-emerald-200/60 to-transparent blur-[70px]" />
        <div className="absolute -right-[160px] -bottom-[200px] h-[520px] w-[520px] rounded-full bg-gradient-to-tl from-indigo-200/60 to-transparent blur-[70px]" />
        <div className="absolute right-[14vw] -top-[120px] h-[340px] w-[340px] rounded-full bg-gradient-to-b from-rose-200/50 to-transparent blur-[80px]" />
      </div>

      <main className="relative z-10 w-full max-w-[400px] px-5 py-10">
        {/* Brand */}
        <div className="mb-7 flex flex-col items-center gap-3">
          <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[13px] bg-gradient-to-br from-teal-600 to-emerald-500 text-[22px] font-extrabold text-white shadow-md">
            CP
          </div>
          <div className="text-center">
            <div className="text-[19px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
              Coaching Planner
            </div>
            <div className="mt-0.5 text-[11.5px] text-zinc-400 dark:text-zinc-500">
              Consuntivi &amp; offerte
            </div>
          </div>
        </div>

        {/* Card di login */}
        <div className="rounded-[20px] border border-zinc-200 bg-white p-7 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-[21px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            Accedi
          </h1>
          <p className="mb-5 mt-1 text-[13px] text-zinc-400 dark:text-zinc-500">
            Entra nella tua area riservata con il tuo account Google.
          </p>

          {/* Messaggio post-logout */}
          {showLogout && (
            <div className="mb-4 flex items-start gap-2 rounded-[11px] border border-emerald-200 bg-emerald-50 p-2.5 text-[13px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0"
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

          {/* Errore generico */}
          {showError && (
            <div
              className="mb-4 flex items-start gap-2 rounded-[11px] border border-rose-200 bg-rose-50 p-2.5 text-[13px] font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
              role="alert"
            >
              <svg
                className="mt-0.5 h-4 w-4 shrink-0"
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
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14.5px] font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 active:translate-y-px disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-750"
          >
            {loading ? (
              <>
                <span
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300"
                  aria-hidden="true"
                />
                Reindirizzamento a Google…
              </>
            ) : (
              <>
                {/* Logo Google */}
                <svg
                  className="h-[18px] w-[18px] shrink-0"
                  viewBox="0 0 18 18"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.97 10.71a5.4 5.4 0 0 1-.29-1.71c0-.6.1-1.18.29-1.71V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
                  />
                </svg>
                Accedi con Google
              </>
            )}
          </button>

          {/* Hint account demo */}
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <b className="font-bold">Demo</b> — solo gli account già censiti
            dall&apos;amministratore possono entrare. Account autorizzati:
            <br />
            <code className="rounded bg-amber-100 px-1 font-semibold dark:bg-amber-900">
              info@techreloaded.it
            </code>{" "}
            → Back Office (amministratore)
            <br />
            <code className="rounded bg-amber-100 px-1 font-semibold dark:bg-amber-900">
              giulia.conti@agilereloaded.it
            </code>{" "}
            → Front Office (collaboratrice)
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] text-zinc-400 dark:text-zinc-500">
          Area riservata · accesso consentito solo al personale autorizzato
        </p>
      </main>
    </div>
  );
}

import { Suspense } from "react";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
