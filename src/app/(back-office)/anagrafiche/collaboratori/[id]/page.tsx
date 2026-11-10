import Link from "next/link";
import { notFound } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";
import { collaboratorePerId, storicoTariffeCollaboratore } from "@/lib/collaboratori";
import { elencaOfferteAbilitate, elencaOfferteAbilitabili } from "@/lib/abilitazioni";
import { tokenMeseCorrente } from "@/domain/calendario";
import {
  ETICHETTA_MODALITA_TARIFFA,
  etichettaMeseTariffa,
  tariffaValidaNelMese,
} from "@/domain/tariffe";
import { descriviImportoTariffa } from "@/lib/formattazione";
import { urlFoglioDaAmministrazione } from "@/lib/url-foglio-attivita";
import AbilitazioniOfferte from "./abilitazioni-offerte";
import StoricoTariffe from "./storico-tariffe";

// ── Pagina ─────────────────────────────────────────────────────

interface DettaglioCollaboratorePageProps {
  params: Promise<{ id: string }>;
}

export default async function DettaglioCollaboratorePage({ params }: DettaglioCollaboratorePageProps) {
  await richiediRuolo("AMMINISTRATORE");

  const { id } = await params;
  const collaboratore = await collaboratorePerId(id);

  if (!collaboratore) {
    notFound();
  }

  const [abilitate, abilitabili, tariffe] = await Promise.all([
    elencaOfferteAbilitate(id),
    elencaOfferteAbilitabili(id),
    storicoTariffeCollaboratore(id),
  ]);
  const meseCorrente = tokenMeseCorrente();
  const tariffaAttuale = tariffaValidaNelMese(tariffe, meseCorrente);

  const nomeCompleto = `${collaboratore.nome} ${collaboratore.cognome}`;
  const iniziali = `${collaboratore.nome[0] ?? ""}${collaboratore.cognome[0] ?? ""}`.toUpperCase();

  return (
    <div>
      <Link
        href="/anagrafiche/collaboratori"
        className="mb-[14px] inline-flex items-center gap-[6px] text-sm font-medium text-testo-secondario no-underline transition hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2.2}>
          <path d="M19 12H5m6 6-6-6 6-6" />
        </svg>
        Collaboratori
      </Link>

      {/* Intestazione profilo */}
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-[14px]">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[12px] bg-indigo-500 text-[15px] font-semibold text-white">
            {iniziali}
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-testo-metadati">
              Anagrafiche · Collaboratori
            </div>
            <h1 className="flex flex-wrap items-center gap-[10px] text-[23px] font-semibold tracking-tight text-testo-principale">
              {nomeCompleto}
              {collaboratore.attivo ? (
                <span className="inline-flex items-center gap-[5px] rounded-full bg-emerald-50 px-[9px] py-[3px] text-xs font-medium whitespace-nowrap text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <span className="h-[6px] w-[6px] rounded-full bg-current" />
                  Attivo
                </span>
              ) : (
                <span className="inline-flex items-center gap-[5px] rounded-full border border-zinc-200 bg-zinc-100 px-[9px] py-[3px] text-xs font-medium whitespace-nowrap text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800">
                  <span className="h-[6px] w-[6px] rounded-full bg-current" />
                  Disattivato
                </span>
              )}
            </h1>
            <div className="mt-[4px] inline-flex items-center gap-[7px] text-sm text-testo-metadati">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] shrink-0 text-testo-metadati" strokeWidth={2}>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              {collaboratore.utente.email}
            </div>
            <div className="mt-[14px]">
              <Link
                href={urlFoglioDaAmministrazione(collaboratore.id)}
                className="inline-flex items-center gap-[8px] rounded-[10px] bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white no-underline shadow-md shadow-indigo-500/30 transition hover:bg-indigo-600"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                Apri foglio attività
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2.2}>
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        <div
          data-testid="tariffa-attuale"
          className="mt-1 shrink-0 rounded-[11px] border border-zinc-200 bg-white px-[16px] py-[10px] shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="text-xs font-medium text-testo-metadati">
            Tariffa attuale
          </div>
          {tariffaAttuale ? (
            <>
              <div className="mt-[2px] text-[16px] font-semibold tabular-nums text-testo-principale">
                {descriviImportoTariffa(tariffaAttuale.modalita, tariffaAttuale.importo)}
              </div>
              <div className="text-xs text-testo-metadati">
                {ETICHETTA_MODALITA_TARIFFA[tariffaAttuale.modalita]} · da{" "}
                {etichettaMeseTariffa(tariffaAttuale.validaDalMese)}
              </div>
            </>
          ) : (
            <div className="mt-[2px] text-sm text-testo-metadati">
              Nessuna tariffa in vigore
            </div>
          )}
        </div>
      </div>

      <StoricoTariffe collaboratoreId={id} voci={tariffe} meseCorrente={meseCorrente} />

      {/* Offerte abilitate */}
      <AbilitazioniOfferte
        collaboratoreId={id}
        abilitate={abilitate}
        abilitabili={abilitabili}
      />
    </div>
  );
}
