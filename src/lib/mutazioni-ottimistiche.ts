// Mutazioni immediate degli elenchi del back office: l'esito previsto si vede
// subito (React `useOptimistic`), l'elemento in attesa resta attenuato finché
// il server non conferma, e in caso di rifiuto lo schermo torna com'era con un
// messaggio che dice cosa non è riuscito e perché.
//
// Qui stanno le parti pure (ordinamenti degli elenchi provvisori, composizione
// dei messaggi) e l'esecuzione della server action, che distingue il rifiuto
// del server, l'errore di rete e la navigazione di Next (redirect) da lasciar
// proseguire. Modulo usato dai componenti client: nessuna dipendenza server.

import { unstable_rethrow } from "next/navigation";
import { MESSAGGIO_ERRORE_DI_RETE } from "@/components/indicatore-salvataggio";

/** Elemento di un elenco ottimistico: `inAttesa` finché il server non lo conferma. */
export type InAttesa<T> = T & { inAttesa?: boolean };

const collazione = new Intl.Collator("it", { sensitivity: "base" });

/** Copia dell'elenco ordinata per cognome e poi per nome, come lo restituisce il server. */
export function ordinaPerCognomeENome<T extends { nome: string; cognome: string }>(
  elenco: readonly T[],
): T[] {
  return [...elenco].sort(
    (a, b) => collazione.compare(a.cognome, b.cognome) || collazione.compare(a.nome, b.nome),
  );
}

/** Copia dell'elenco ordinata per ragione sociale del cliente e poi per codice offerta. */
export function ordinaPerClienteECodice<T extends { clienteRagioneSociale: string; codice: string }>(
  elenco: readonly T[],
): T[] {
  return [...elenco].sort(
    (a, b) =>
      collazione.compare(a.clienteRagioneSociale, b.clienteRagioneSociale) ||
      collazione.compare(a.codice, b.codice),
  );
}

/**
 * Aggiunge all'elenco gli elementi nuovi non ancora presenti (stessa chiave) e
 * riordina il risultato con `ordina`.
 */
export function conAggiunte<T>(
  elenco: readonly T[],
  aggiunte: readonly T[],
  chiave: (elemento: T) => string,
  ordina: (elenco: readonly T[]) => T[],
): T[] {
  const presenti = new Set(elenco.map(chiave));
  return ordina([...elenco, ...aggiunte.filter((elemento) => !presenti.has(chiave(elemento)))]);
}

/**
 * Storico tariffe con la voce salvata al suo posto: sostituisce la voce
 * `idSostituito` (modifica) o aggiunge la nuova, e riordina dalla più recente.
 */
export function conVoceTariffa<T extends { id: string; validaDalMese: string }>(
  voci: readonly T[],
  voce: T,
  idSostituito: string | null,
): T[] {
  return [...voci.filter((esistente) => esistente.id !== idSostituito), voce].sort((a, b) =>
    b.validaDalMese.localeCompare(a.validaDalMese),
  );
}

/** "A", "A e B", "A, B e C". */
export function elencoLeggibile(voci: readonly string[]): string {
  if (voci.length <= 1) return voci[0] ?? "";
  return `${voci.slice(0, -1).join(", ")} e ${voci.at(-1)}`;
}

/** Minuscola iniziale, salvo sigle come «ID offerta mancante». */
function minuscolaIniziale(testo: string): string {
  const [prima = "", seconda = ""] = testo;
  if (seconda && seconda !== seconda.toLowerCase()) return testo;
  return prima.toLowerCase() + testo.slice(1);
}

/**
 * Messaggio di una mutazione non riuscita: `operazione` dice cosa non è
 * riuscito (es. «La revoca di Mario Rossi non è riuscita»), `motivo` il perché
 * dato dal server; senza motivo la causa è la rete o una risposta inattesa.
 */
export function messaggioMutazioneNonRiuscita(operazione: string, motivo: string | null): string {
  const motivoPulito = motivo?.trim();
  if (!motivoPulito) return `${operazione}. ${MESSAGGIO_ERRORE_DI_RETE}`;
  return `${operazione}: ${minuscolaIniziale(motivoPulito)}`;
}

/** Stato restituito dalle server action degli elenchi (forma di useActionState). */
export interface StatoMutazione {
  errori: Record<string, string>;
  successo?: boolean;
}

export type EsitoMutazione =
  | { riuscita: true }
  | {
      riuscita: false;
      /** Errori per campo restituiti dal server; vuoto per errori di rete. */
      errori: Record<string, string>;
      /** Perché il server ha rifiutato; `null` se il server non ha risposto. */
      motivo: string | null;
    };

/** Legge l'esito dallo stato restituito da una server action. */
export function esitoDaStato(stato: StatoMutazione | void | undefined): EsitoMutazione {
  const errori = stato?.errori ?? {};
  if (!stato || stato.successo || Object.keys(errori).length === 0) {
    return { riuscita: true };
  }
  return { riuscita: false, errori, motivo: errori._form ?? Object.values(errori)[0] ?? null };
}

/**
 * Esegue la server action di una mutazione ottimistica. Il rifiuto del server
 * e l'errore di rete diventano un esito non riuscito; redirect e notFound di
 * Next vengono rilanciati, così la navigazione prosegue come previsto.
 */
export async function eseguiMutazione(
  azione: () => Promise<StatoMutazione | void>,
): Promise<EsitoMutazione> {
  try {
    return esitoDaStato(await azione());
  } catch (errore) {
    unstable_rethrow(errore);
    return { riuscita: false, errori: {}, motivo: null };
  }
}
