import Link from "next/link";
import { richiediPermesso } from "@/lib/dal";
import { elencaOfferteConAvanzamentoPaginate } from "@/lib/offerte";
import { leggiFiltriElencoOfferte, parametriFiltroOfferte, type ParametriElencoOfferte } from "@/lib/elenco-offerte";
import { urlPosizioneElenco } from "@/lib/paginazione";
import OfferteTabella from "./offerte-tabella";

interface OffertePageProps {
  searchParams: Promise<ParametriElencoOfferte & {
    esito?: string | string[];
    offertaEspansaId?: string | string[];
  }>;
}

function primoParametro(parametro?: string | string[]): string | undefined {
  return Array.isArray(parametro) ? parametro[0] : parametro;
}

/** Messaggio del banner verde di esito in base al parametro `esito`. */
function messaggioPerEsito(esito?: string): string | null {
  switch (esito) {
    case "offerta-creata":
      return "Offerta creata correttamente";
    case "offerta-salvata":
      return "Modifiche all'offerta salvate";
    case "offerta-eliminata":
      return "Offerta eliminata";
    case "stato-offerta-aggiornato":
      return "Stato dell'offerta aggiornato";
    default:
      return null;
  }
}

export default async function OffertePage({ searchParams }: OffertePageProps) {
  await richiediPermesso("GESTIRE_OFFERTE");
  const parametri = await searchParams;
  const { esito, offertaEspansaId } = parametri;
  const filtri = leggiFiltriElencoOfferte(parametri);
  const elenco = await elencaOfferteConAvanzamentoPaginate(filtri);
  const messaggioEsito = messaggioPerEsito(primoParametro(esito));
  const offertaEspansaIdIniziale = primoParametro(offertaEspansaId);

  return (
    <div>
      {/* Intestazione view */}
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-medium text-testo-metadati">
            Anagrafiche
          </div>
          <h1 className="text-[23px] font-semibold tracking-tight text-testo-principale">
            Offerte
          </h1>
          <p className="mt-[6px] max-w-[620px] text-sm text-testo-metadati">
            Gestisci l&apos;intero ciclo di vita delle offerte da un unico punto:
            crea una nuova offerta scegliendo il cliente, modificala, attivala o
            disattivala, oppure eliminala quando non ha attività collegate. Le
            offerte non attive sono indicate dallo stato «Disattivata»; residuo
            esaurito o negativo è evidenziato in rosso.
          </p>
        </div>
        <div className="mt-1 flex shrink-0 items-center gap-[10px]">
          <Link
            href={urlPosizioneElenco("/offerte/nuova", { ...filtri, pagina: elenco.paginaCorrente }, parametriFiltroOfferte(filtri.soloDaPresidiare))}
            className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[15px] py-[9px] text-sm font-medium text-white shadow-sm no-underline transition hover:bg-indigo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nuova offerta
          </Link>
        </div>
      </div>

      {messaggioEsito && (
        <div className="mb-[18px] flex max-w-[840px] items-start gap-[9px] rounded-[11px] border border-emerald-200 bg-emerald-50 px-[13px] py-[11px] text-sm font-medium leading-[1.45] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-[1.5px] h-[16px] w-[16px] shrink-0" strokeWidth={2}>
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span>{messaggioEsito}</span>
        </div>
      )}

      {/* Tabella offerte */}
      <OfferteTabella
        elenco={elenco}
        ricerca={filtri.ricerca}
        soloDaPresidiare={filtri.soloDaPresidiare}
        offertaEspansaIdIniziale={offertaEspansaIdIniziale}
      />
    </div>
  );
}
