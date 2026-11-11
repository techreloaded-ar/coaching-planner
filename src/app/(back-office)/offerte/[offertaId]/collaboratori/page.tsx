import Link from "next/link";
import { notFound } from "next/navigation";
import { richiediPermesso } from "@/lib/dal";
import { offertaPerId } from "@/lib/offerte";
import {
  elencaCollaboratoriIngaggiati,
  elencaCollaboratoriIngaggiabili,
} from "@/lib/abilitazioni";
import { formattaEuro, inizialiCliente } from "@/lib/formattazione";
import IngaggiCollaboratori from "./ingaggi-collaboratori";

interface CollaboratoriOffertaPageProps {
  params: Promise<{ offertaId: string }>;
}

export default async function CollaboratoriOffertaPage({
  params,
}: CollaboratoriOffertaPageProps) {
  await richiediPermesso("GESTIRE_ABILITAZIONI");

  const { offertaId } = await params;
  const offerta = await offertaPerId(offertaId);

  if (!offerta) {
    notFound();
  }

  const [ingaggiati, ingaggiabili] = await Promise.all([
    elencaCollaboratoriIngaggiati(offertaId),
    elencaCollaboratoriIngaggiabili(offertaId),
  ]);

  // La tabella sotto elenca anche gli ingaggi storici verso profili nel
  // frattempo disattivati (AC-1); questo conteggio riflette invece solo chi
  // può attualmente inserire ore sull'offerta.
  const collaboratoriAttivi = ingaggiati.filter(
    (collaboratore) => collaboratore.collaboratoreAttivo,
  ).length;

  return (
    <div>
      <Link
        href="/offerte"
        className="mb-[14px] inline-flex items-center gap-[6px] text-sm font-medium text-testo-secondario no-underline transition hover:text-indigo-600 dark:hover:text-indigo-400"
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
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                {offerta.codice}
              </span>
              {offerta.attiva ? (
                <span className="inline-flex items-center gap-[5px] rounded-full bg-emerald-50 px-[9px] py-[3px] text-xs font-medium whitespace-nowrap text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <span className="h-[6px] w-[6px] rounded-full bg-current" />
                  Attiva
                </span>
              ) : (
                <span className="inline-flex items-center gap-[5px] rounded-full border border-zinc-200 bg-zinc-100 px-[9px] py-[3px] text-xs font-medium whitespace-nowrap text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800">
                  <span className="h-[6px] w-[6px] rounded-full bg-current" />
                  Non attiva
                </span>
              )}
            </div>
            <h1 className="text-[23px] font-semibold tracking-tight text-testo-principale">
              {offerta.descrizione || offerta.codice}
            </h1>
            <div className="mt-[6px] flex flex-wrap items-center gap-x-[18px] gap-y-[6px] text-sm text-testo-metadati">
              <span className="inline-flex min-w-0 items-center gap-[8px]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-zinc-200 bg-zinc-50 text-xs font-medium text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800">
                  {inizialiCliente(offerta.cliente.ragioneSociale)}
                </span>
                <b className="min-w-0 truncate font-semibold text-testo-secondario">
                  {offerta.cliente.ragioneSociale}
                </b>
              </span>
              <span className="inline-flex items-center gap-[7px]">
                Tariffa giornaliera
                <b className="font-semibold tabular-nums text-testo-secondario">
                  {formattaEuro(offerta.tariffaGiornaliera?.toString() ?? null)}
                </b>
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col justify-center border-l border-zinc-200 py-1 pl-5 text-right max-[720px]:mt-1 max-[720px]:w-full max-[720px]:border-t max-[720px]:border-l-0 max-[720px]:pt-3 max-[720px]:pl-0 max-[720px]:text-left dark:border-zinc-800">
          <span className="mb-1 text-xs font-medium text-testo-metadati">
            Squadra attiva
          </span>
          <span className="text-[22px] font-semibold tracking-tight text-testo-principale tabular-nums">
            {collaboratoriAttivi}
          </span>
          <span className="text-xs font-medium text-testo-metadati">
            {collaboratoriAttivi === 1 ? "collaboratore" : "collaboratori"}
          </span>
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
