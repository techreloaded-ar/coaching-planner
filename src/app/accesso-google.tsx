"use client";

import { useState } from "react";

export default function AccessoGoogle() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = () => {
    setLoading(true);
    window.location.href = "/api/auth/google";
  };

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      disabled={loading}
      aria-busy={loading}
      className="flex w-full max-w-[340px] items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14.5px] font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 active:translate-y-px disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-750"
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
  );
}
