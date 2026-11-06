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
  return <div className="mx-auto max-w-6xl space-y-6 text-zinc-800 dark:text-zinc-100">
    <header className="flex flex-wrap items-start justify-between gap-4"><div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Migrazione dal vecchio sistema · {stato.ambiente}</p>
      <h1 className="mt-1 text-2xl font-bold">Importazione</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">Leggi il foglio e controlla aggiunte, aggiornamenti e scarti prima di importare. L’analisi non modifica giornate o anagrafiche.</p>
    </div><Link href="/righe-sospese" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">Righe sospese</Link></header>
    {params.errore && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">{params.errore.slice(0, 500)}</p>}
    {params.salvata && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-100">Importazione completata. Le righe approvate sono state aggiunte o aggiornate. Avvia una nuova analisi per verificare eventuali righe ancora da gestire.</p>}
    {job && !compatibile && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">Le regole di importazione sono cambiate. Avvia una nuova analisi dal foglio per vedere le associazioni a SENZA CODICE prima di importare. Nessuna giornata è stata modificata.</p>}
    <section aria-label="Origine importazione" className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-semibold">Documento di origine</h2>
      {stato.documento ? <a href={stato.documento} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 underline dark:text-indigo-400">Apri il foglio Google configurato</a> : <p className="text-sm">Nessun documento configurato.</p>}
      <p className="text-sm">L’analisi considera tutte le giornate del foglio, senza limiti di data. Nessuna giornata viene cancellata automaticamente.</p>
      {(!stato.abilitato || !stato.configurato) && <p role="status" className="text-sm text-amber-800 dark:text-amber-300">{!stato.abilitato ? "Importazione disabilitata in questo ambiente." : "Configurazione incompleta: occorrono documento Google e service account sul server."}</p>}
      <AnalizzaForm key={job?.id ?? "iniziale"} disabilitato={!stato.abilitato || !stato.configurato} />
    </section>
    {piano && job && <section aria-label="Risultato analisi" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Ultima lettura del {job.createdAt.toLocaleString("it-IT", { timeZone: "Europe/Rome" })}</h2>
      </div>
      <p className="text-sm text-zinc-500">Ogni lettura sostituisce questa anteprima. Non viene mantenuto uno storico delle importazioni. Alla conferma si aggiungono i dati mancanti e si aggiornano le giornate riconosciute; quelle assenti dal foglio restano nell’app.</p>
      <Anteprima key={`${job.id}:${job.updatedAt.toISOString()}`} piano={piano} id={job.id} revisione={job.updatedAt.toISOString()} completata={job.stato !== "ANTEPRIMA"} />
    </section>}
  </div>;
}
