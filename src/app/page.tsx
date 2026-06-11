export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
        Coaching Planner
      </h1>
      <p className="mt-4 max-w-md text-center text-lg text-zinc-600 dark:text-zinc-400">
        Il gestionale per la consuntivazione mensile di collaboratori, clienti e
        offerte.
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/login"
          className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Accedi
        </a>
      </div>
    </div>
  );
}
