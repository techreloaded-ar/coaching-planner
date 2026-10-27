import "server-only";

import { db } from "@/lib/db";
import { inviaEmail } from "@/lib/email";
import { giornoCivile } from "@/domain/calendario-google";
import {
  contenutoEmailPromemoriaFineMese,
  eUltimoGiornoLavorativoDelMese,
} from "@/domain/promemoria-fine-mese";

// Promemoria email di fine mese (US-019) a tutti i collaboratori attivi.
//
// AUTOMATICA (cron): solo l'ultimo giorno lavorativo del mese, al massimo una
// volta per collaboratore e mese grazie al registro PromemoriaFineMeseInviato.
// MANUALE (pulsante dell'amministratore): invia subito per il mese corrente,
// senza controllare la data e senza leggere né scrivere il registro.

export type ModalitaPromemoriaFineMese = "AUTOMATICA" | "MANUALE";

export interface EsitoPromemoriaFineMese {
  inviati: number;
  giaInviati: number;
  falliti: number;
}

function urlApplicazione(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function eDoppione(errore: unknown): boolean {
  return (errore as { code?: string } | null)?.code === "P2002";
}

export async function inviaPromemoriaFineMese({
  modalita,
  adesso = new Date(),
}: {
  modalita: ModalitaPromemoriaFineMese;
  adesso?: Date;
}): Promise<EsitoPromemoriaFineMese> {
  const esito: EsitoPromemoriaFineMese = { inviati: 0, giaInviati: 0, falliti: 0 };
  const oggi = giornoCivile(adesso);
  const mese = oggi.slice(0, 7);
  const automatica = modalita === "AUTOMATICA";
  if (automatica && !eUltimoGiornoLavorativoDelMese(oggi)) return esito;

  const collaboratori = await db.collaboratore.findMany({
    where: { attivo: true, utente: { attivo: true } },
    select: { id: true, nome: true, utente: { select: { email: true } } },
  });

  // ponytail: invii sequenziali con una connessione SMTP per email. Se i
  // collaboratori superano il centinaio, passare a pool: true e riusare il transport.
  for (const collaboratore of collaboratori) {
    const chiave = { collaboratoreId: collaboratore.id, mese };
    if (automatica) {
      try {
        await db.promemoriaFineMeseInviato.create({ data: chiave });
      } catch (errore) {
        if (!eDoppione(errore)) throw errore;
        esito.giaInviati++;
        continue;
      }
    }

    const { oggetto, testo } = contenutoEmailPromemoriaFineMese({
      nome: collaboratore.nome,
      mese,
      urlApplicazione: urlApplicazione(),
    });
    if (await inviaEmail({ destinatario: collaboratore.utente.email, oggetto, testo })) {
      esito.inviati++;
      continue;
    }

    esito.falliti++;
    // Senza prenotazione la prossima invocazione del cron ritenta.
    if (automatica) {
      await db.promemoriaFineMeseInviato.delete({
        where: { collaboratoreId_mese: chiave },
      });
    }
  }

  return esito;
}
