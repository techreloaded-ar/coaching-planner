"use client";

import { useCallback, useOptimistic, useRef, useState, useTransition } from "react";
import {
  eseguiMutazione,
  messaggioMutazioneNonRiuscita,
  type EsitoMutazione,
  type StatoMutazione,
} from "@/lib/mutazioni-ottimistiche";
import { AvvisoMutazioneNonRiuscita } from "./indicatore-salvataggio";

interface AvvisoMutazione {
  id: number;
  messaggio: string;
}

/**
 * Messaggi delle mutazioni non riuscite di un elenco. Più operazioni possono
 * essere in volo insieme: ogni rifiuto aggiunge il proprio messaggio, che
 * resta finché l'utente non lo chiude o non avvia una nuova operazione.
 */
function useAvvisiMutazioni() {
  const [avvisi, setAvvisi] = useState<AvvisoMutazione[]>([]);
  const ultimoId = useRef(0);

  const aggiungi = useCallback((messaggio: string) => {
    ultimoId.current += 1;
    const id = ultimoId.current;
    setAvvisi((precedenti) => [...precedenti, { id, messaggio }]);
  }, []);
  const chiudi = useCallback(
    (id: number) => setAvvisi((precedenti) => precedenti.filter((avviso) => avviso.id !== id)),
    [],
  );
  const azzera = useCallback(() => setAvvisi([]), []);

  return { avvisi, aggiungi, chiudi, azzera };
}

export interface OpzioniMutazione {
  /** Cosa non è riuscito, es. «La revoca di Mario Rossi non è riuscita». */
  operazione: string;
  /**
   * Gestione dedicata del rifiuto (es. riaprire un modulo con l'errore sul
   * campo): se restituisce `true` l'avviso generico non viene mostrato.
   */
  alRifiuto?: (esito: Extract<EsitoMutazione, { riuscita: false }>) => boolean;
}

/**
 * Elenco con mutazioni immediate. `muta` applica subito la mutazione prevista
 * (`useOptimistic`) e chiama la server action dentro una transizione: lo stato
 * provvisorio resta finché la transizione non termina, cioè fino al rerender
 * con i dati confermati (revalidatePath o redirect), e poi torna ai props del
 * server. Se il server rifiuta o non risponde, l'elenco torna com'era e compare
 * un avviso che dice cosa non è riuscito e perché.
 *
 * `salvataggioInCorso` vale `true` finché almeno una mutazione è in volo:
 * esporlo come `aria-busy` sul contenitore dà ai test e alle tecnologie
 * assistive un segnale osservabile della conferma.
 */
export function useMutazioniElenco<T, M>(valore: T, applica: (stato: T, mutazione: M) => T) {
  const [elenco, applicaOttimistica] = useOptimistic(valore, applica);
  const [salvataggioInCorso, segnaSalvataggio] = useOptimistic(false);
  const [, avviaTransizione] = useTransition();
  const { avvisi, aggiungi, chiudi, azzera } = useAvvisiMutazioni();

  function muta(
    mutazione: M,
    azione: () => Promise<StatoMutazione | void>,
    { operazione, alRifiuto }: OpzioniMutazione,
  ) {
    azzera();
    avviaTransizione(async () => {
      segnaSalvataggio(true);
      applicaOttimistica(mutazione);
      // Un redirect della server action viene rilanciato da eseguiMutazione e
      // arriva al RedirectBoundary di Next attraverso la transizione.
      const esito = await eseguiMutazione(azione);
      if (esito.riuscita) return;
      if (alRifiuto?.(esito)) return;
      aggiungi(messaggioMutazioneNonRiuscita(operazione, esito.motivo));
    });
  }

  return { elenco, salvataggioInCorso, muta, avvisi, chiudiAvviso: chiudi };
}

/** Elenco degli avvisi di mutazione non riuscita, ciascuno chiudibile. */
export function AvvisiMutazioni({
  avvisi,
  onChiudi,
  className = "",
}: {
  avvisi: readonly AvvisoMutazione[];
  onChiudi: (id: number) => void;
  className?: string;
}) {
  if (avvisi.length === 0) return null;
  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      {avvisi.map((avviso) => (
        <AvvisoMutazioneNonRiuscita
          key={avviso.id}
          messaggio={avviso.messaggio}
          onChiudi={() => onChiudi(avviso.id)}
        />
      ))}
    </div>
  );
}
