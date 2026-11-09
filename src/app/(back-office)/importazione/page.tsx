import Link from "next/link";
import { richiediRuolo } from "@/lib/dal";
import { db } from "@/lib/db";
import { statoConfigurazione, configurazioneImporter } from "@/lib/importer-legacy/config";
import { leggiPiano } from "@/lib/importer-legacy/servizio";
import AnalizzaForm from "./analizza-form";
import Anteprima from "./anteprima";

export const maxDuration = 120;

export default async function ImportazionePage({ searchParams }: {
  searchParams: Promise<{ id?: string; errore?: string; salvata?: string }>;
}) {
  const user = await richiediRuolo("AMMINISTRATORE");
  const params = await searchParams;
  const stato = statoConfigurazione();
  const cfg = configurazioneImporter();
  const job = stato.abilitato && stato.configurato && params.id && !params.salvata ? await db.importazioneLegacy.findFirst({
    where: { id: params.id, origine: cfg.id, autoreId: user.utenteId, stato: "ANTEPRIMA" },
  }) : null;
  const compatibile = job && (job.piano as { versione?: number } | null)?.versione === 4;
  const piano = compatibile ? leggiPiano(job.piano) : null;
  return <div className="mx-auto flex max-w-6xl flex-col gap-3 text-zinc-800 max-sm:-mx-5 max-sm:-my-3 dark:text-zinc-100 [@media(min-width:1024px)_and_(min-height:640px)]:h-[calc(100dvh-var(--altezza-banner-ambiente)-117px)] [@media(min-width:1024px)_and_(min-height:640px)]:min-h-0">
    <header className="flex shrink-0 flex-wrap items-start justify-between gap-4"><div>
      <h1 className="text-2xl font-bold">Importazione</h1>
    </div><Link href="/righe-sospese" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">Righe sospese</Link></header>
    {params.errore && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">{params.errore.slice(0, 500)}</p>}
    {params.salvata && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-100">Importazione completata. Le operazioni confermate sono state applicate. Avvia una nuova analisi per verificare eventuali righe ancora da gestire.</p>}
    {job && !compatibile && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">Le regole di importazione sono cambiate. Avvia una nuova analisi dal foglio per vedere le associazioni a SENZA CODICE prima di importare. Nessuna giornata è stata modificata.</p>}
    <section aria-label="Origine importazione" className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="space-y-1"><h2 className="text-sm font-semibold">Foglio di origine</h2>
      {stato.documento ? <a href={stato.documento} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 underline dark:text-indigo-400">Apri il foglio Google configurato</a> : <p className="text-sm">Nessun documento configurato.</p>}
      {(!stato.abilitato || !stato.configurato) && <p role="status" className="text-sm text-amber-800 dark:text-amber-300">{!stato.abilitato ? "Importazione disabilitata in questo ambiente." : "Configurazione incompleta: occorrono documento Google e service account sul server."}</p>}
      </div>
      <AnalizzaForm key={job?.id ?? "iniziale"} disabilitato={!stato.abilitato || !stato.configurato} />
    </section>
    {piano && job && <section aria-label="Risultato analisi" className="flex min-h-0 flex-1 flex-col">
      <Anteprima key={`${job.id}:${job.updatedAt.toISOString()}`} piano={piano} id={job.id} revisione={job.updatedAt.toISOString()} completata={job.stato !== "ANTEPRIMA"} />
    </section>}
  </div>;
}
