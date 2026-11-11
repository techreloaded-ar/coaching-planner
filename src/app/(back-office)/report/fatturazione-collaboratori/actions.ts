"use server";

import { redirect } from "next/navigation";
import { richiediPermessoApi } from "@/lib/dal";
import { inviaPromemoriaFineMese } from "@/lib/promemoria-fine-mese";

/** Invia subito il promemoria di fine mese a tutti i collaboratori attivi (US-019). */
export async function inviaPromemoriaFineMeseOra(): Promise<void> {
  await richiediPermessoApi("CONSULTARE_REPORT_FATTURAZIONE_COLLABORATORI");

  const esito = await inviaPromemoriaFineMese({ modalita: "MANUALE" });

  redirect(
    `/report/fatturazione-collaboratori?promemoriaInviati=${esito.inviati}&promemoriaFalliti=${esito.falliti}`
  );
}
