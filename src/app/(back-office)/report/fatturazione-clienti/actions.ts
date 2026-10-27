"use server";

import { redirect } from "next/navigation";
import { richiediRuoloApi } from "@/lib/dal";
import { inviaPromemoriaFineMese } from "@/lib/promemoria-fine-mese";

/** Invia subito il promemoria di fine mese a tutti i collaboratori attivi (US-019). */
export async function inviaPromemoriaFineMeseOra(): Promise<void> {
  await richiediRuoloApi("AMMINISTRATORE");

  const esito = await inviaPromemoriaFineMese({ modalita: "MANUALE" });

  redirect(
    `/report/fatturazione-clienti?promemoriaInviati=${esito.inviati}&promemoriaFalliti=${esito.falliti}`
  );
}
