import type { RigaAttivitaClient } from "@/lib/attivita-contract";

/**
 * Feedback immediato del dettaglio giornata: le mutazioni inviate al server e
 * non ancora confermate si vedono subito sulle righe del giorno.
 *
 * - `nuova`: la riga provvisoria compare in coda, con i dati del form;
 * - `modifica`: la riga mostra già i nuovi valori;
 * - `eliminazione`: la riga sparisce.
 *
 * Alla conferma l'operazione viene tolta e le righe del server la sostituiscono;
 * al rifiuto viene tolta e la riga torna com'era.
 */
export type OperazioneRigaInAttesa =
  | { tipo: "nuova"; chiave: string; riga: RigaAttivitaClient }
  | { tipo: "modifica"; chiave: string; riga: RigaAttivitaClient }
  | { tipo: "eliminazione"; chiave: string; rigaId: string };

/** Riga mostrata: quella del server o una provvisoria, in attesa di conferma. */
export type RigaMostrata = RigaAttivitaClient & { inAttesa: boolean };

/** Prefisso degli id delle righe provvisorie: non collidono con gli id del server. */
export const PREFISSO_RIGA_PROVVISORIA = "provvisoria-";

/** Applica alle righe del server le operazioni ancora in attesa, nell'ordine di invio. */
export function righeConOperazioniInAttesa(
  righe: readonly RigaAttivitaClient[],
  operazioni: readonly OperazioneRigaInAttesa[],
): RigaMostrata[] {
  let mostrate: RigaMostrata[] = righe.map((riga) => ({ ...riga, inAttesa: false }));

  for (const operazione of operazioni) {
    switch (operazione.tipo) {
      case "nuova":
        mostrate = [...mostrate, { ...operazione.riga, inAttesa: true }];
        break;
      case "modifica":
        mostrate = mostrate.map((riga) =>
          riga.id === operazione.riga.id ? { ...operazione.riga, inAttesa: true } : riga,
        );
        break;
      case "eliminazione":
        mostrate = mostrate.filter((riga) => riga.id !== operazione.rigaId);
        break;
    }
  }

  return mostrate;
}
