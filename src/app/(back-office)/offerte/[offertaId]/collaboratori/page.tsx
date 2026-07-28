import Link from "next/link";
import { notFound } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";
import { offertaPerId } from "@/lib/offerte";
import {
  elencaCollaboratoriIngaggiati,
  elencaCollaboratoriIngaggiabili,
} from "@/lib/abilitazioni";
import IngaggiCollaboratori from "./ingaggi-collaboratori";

function formattaEuro(valore: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(valore);
}

/** Iniziali della ragione sociale del cliente per l'avatar quadrato. */
function inizialiCliente(ragioneSociale: string): string {
  return ragioneSociale
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parola) => parola[0]?.toUpperCase() ?? "")
    .join("");
}

interface CollaboratoriOffertaPageProps {
  params: Promise<{ offertaId: string }>;
}

export default async function CollaboratoriOffertaPage({
  params,
}: CollaboratoriOffertaPageProps) {
  await richiediRuolo("AMMINISTRATORE");

  const { offertaId } = await params;
  const offerta = await offertaPerId(offertaId);

  if (!offerta) {
    notFound();
  }

  const [ingaggiati, ingaggiabili] = await Promise.all([
    elencaCollaboratoriIngaggiati(offertaId),
    elencaCollaboratoriIngaggiabili(offertaId),
  ]);

  return (
    <div>
      <Link
        href="/offerte"
        className="mb-[14px] inline-flex items-center gap-[6px] text-[13px] font-semibold text-zinc-600 no-underline transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2.2}>
          <path d="M19 12H5m6 6-6-6 6-6" />
        </svg>
        Offerte
      </Link>

      {/* Testata dell'offerta */}
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-[14px]">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[12px] bg-indigo-500 text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[22px] w-[22px]" strokeWidth={1.9}>
              <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
              <path d="M14 3v6h6M8 13h8M8 17h5" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-[9px]">
              <span className="text-[12px] font-semibold uppercase tracking-[.04em] text-indigo-600 dark:text-indigo-400">
                {offerta.codice}
              </span>
              {offerta.attiva ? (
                <span className="inline-flex items-center gap-[5px] rounded-full bg-emerald-50 px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <span className="h-[6px] w-[6px] rounded-full bg-current" />
                  Attiva
                </span>
              ) : (
                <span className="inline-flex items-center gap-[5px] rounded-full border border-zinc-200 bg-zinc-100 px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                  <span className="h-[6px] w-[6px] rounded-full bg-current" />
                  Non attiva
                </span>
              )}
            </div>
            <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
              {offerta.descrizione}
            </h1>
            <div className="mt-[6px] flex flex-wrap items-center gap-x-[18px] gap-y-[6px] text-[13px] text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex min-w-0 items-center gap-[8px]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-zinc-200 bg-zinc-50 text-[10.5px] font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {inizialiCliente(offerta.cliente.ragioneSociale)}
                </span>
                <b className="min-w-0 truncate font-semibold text-zinc-700 dark:text-zinc-200">
                  {offerta.cliente.ragioneSociale}
                </b>
              </span>
              <span className="inline-flex items-center gap-[7px]">
                Tariffa giornaliera
                <b className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                  {formattaEuro(Number(offerta.tariffaGiornaliera))}
                </b>
              </span>
            </div>
          </div>
        </div>
      </div>

      <IngaggiCollaboratori
        offertaId={offertaId}
        codiceOfferta={offerta.codice}
        ingaggiati={ingaggiati}
        ingaggiabili={ingaggiabili}
      />
    </div>
  );
}
