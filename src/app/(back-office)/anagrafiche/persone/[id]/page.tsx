import Link from "next/link";
import { notFound } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";
import { utentePerId } from "@/lib/utenti";
import { storicoTariffeCollaboratore } from "@/lib/collaboratori";
import {
  elencaOfferteAbilitate,
  elencaOfferteAbilitabili,
} from "@/lib/abilitazioni";
import { tokenMeseCorrente } from "@/domain/calendario";
import {
  ETICHETTA_MODALITA_TARIFFA,
  etichettaMeseTariffa,
  tariffaValidaNelMese,
} from "@/domain/tariffe";
import { descriviImportoTariffa } from "@/lib/formattazione";
import { urlFoglioDaAmministrazione } from "@/lib/url-foglio-attivita";
import AbilitazioniOfferte from "../../collaboratori/[id]/abilitazioni-offerte";
import StoricoTariffe from "../../collaboratori/[id]/storico-tariffe";
import PersonaForm from "../persona-form";

export default async function PersonaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sezione?: string; esito?: string }>;
}) {
  await richiediRuolo("AMMINISTRATORE");
  const { id } = await params;
  const { sezione, esito } = await searchParams;
  const utente = await utentePerId(id);
  if (!utente) notFound();
  let attivita = null;
  if (utente.collaboratore) {
    const collaboratoreId = utente.collaboratore.id;
    const [abilitate, abilitabili, tariffe] = await Promise.all([
      elencaOfferteAbilitate(collaboratoreId),
      elencaOfferteAbilitabili(collaboratoreId),
      storicoTariffeCollaboratore(collaboratoreId),
    ]);
    const meseCorrente = tokenMeseCorrente();
    const tariffaAttuale = tariffaValidaNelMese(tariffe, meseCorrente);
    attivita = (
      <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <Link
            href={urlFoglioDaAmministrazione(collaboratoreId)}
            className="inline-flex rounded-[10px] bg-indigo-500 px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-indigo-600"
          >
            Apri foglio attività
          </Link>
          <div
            data-testid="tariffa-attuale"
            className="rounded-[11px] border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Tariffa attuale
            </div>
            {tariffaAttuale ? (
              <>
                <div className="text-[18px] font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                  {descriviImportoTariffa(
                    tariffaAttuale.modalita,
                    tariffaAttuale.importo,
                  )}
                </div>
                <div className="text-[12px] text-zinc-500 dark:text-zinc-400">
                  {ETICHETTA_MODALITA_TARIFFA[tariffaAttuale.modalita]} · da{" "}
                  {etichettaMeseTariffa(tariffaAttuale.validaDalMese)}
                </div>
              </>
            ) : (
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Nessuna tariffa in vigore
              </p>
            )}
          </div>
        </div>
        <StoricoTariffe
          collaboratoreId={collaboratoreId}
          voci={tariffe}
          meseCorrente={meseCorrente}
        />
        <AbilitazioniOfferte
          collaboratoreId={collaboratoreId}
          abilitate={abilitate}
          abilitabili={abilitabili}
        />
      </>
    );
  }
  return (
    <PersonaForm
      key={utente.id}
      utente={utente}
      attivita={attivita}
      sezioneIniziale={sezione}
      salvato={esito === "salvato"}
    />
  );
}
