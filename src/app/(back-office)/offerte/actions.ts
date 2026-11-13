"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { richiediPermessoApi } from "@/lib/dal";
import { urlPosizioneElenco } from "@/lib/paginazione";
import { leggiFiltriElencoOfferteDaForm, parametriFiltroOfferte } from "@/lib/elenco-offerte";
import { leggiIdSelezionati } from "@/lib/selezione-elenco";

const MESSAGGIO_BLOCCO_ELIMINAZIONE =
  "Impossibile eliminare l'offerta: esistono righe attività collegate. Disattiva l'offerta invece di eliminarla.";

async function guardiaGestioneOfferte(): Promise<void> {
  await richiediPermessoApi("GESTIRE_OFFERTE");
}

function isPrismaForeignKeyConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === "object" && error !== null && "code" in error)
  )
    ? (error as { code?: string }).code === "P2003"
    : false;
}

/**
 * Server action per disattivare o riattivare una o più offerte (un campo `id`
 * per offerta, `attivo` "true"/"false"). Chiamata dalla barra azioni e dal
 * modale di eliminazione bloccata nella pagina offerte.
 */
export async function cambiaStatoOfferta(formData: FormData): Promise<void> {
  await guardiaGestioneOfferte();

  const idOfferte = leggiIdSelezionati(formData);
  const attiva = formData.get("attivo") === "true";
  const offertaEspansaId = formData.get("offertaEspansaId");
  const filtri = leggiFiltriElencoOfferteDaForm(formData);

  if (idOfferte.length === 0) {
    redirect(urlPosizioneElenco("/offerte", filtri, parametriFiltroOfferte(filtri.soloDaPresidiare)));
  }

  await db.offerta.updateMany({
    where: { id: { in: idOfferte } },
    data: { attiva },
  });

  revalidatePath("/offerte");

  const altriParametri: Record<string, string> = {
    esito: "stato-offerta-aggiornato",
    ...parametriFiltroOfferte(filtri.soloDaPresidiare),
  };
  if (typeof offertaEspansaId === "string" && offertaEspansaId) {
    altriParametri.offertaEspansaId = offertaEspansaId;
  }
  redirect(
    urlPosizioneElenco(
      "/offerte",
      filtri,
      altriParametri,
    ),
  );
}

export interface StatoEliminazioneOfferta {
  errore?: string;
}

/**
 * Server action per eliminare un'offerta.
 * L'eliminazione è bloccata a livello applicativo quando esistono righe attività
 * collegate; il catch su P2003 protegge da race condition tra conteggio e delete.
 */
export async function eliminaOfferta(
  _prevState: StatoEliminazioneOfferta,
  formData: FormData
): Promise<StatoEliminazioneOfferta> {
  await guardiaGestioneOfferte();

  const offertaId = formData.get("id") as string;
  if (!offertaId) {
    return { errore: "ID offerta mancante" };
  }

  const righeAttivitaCollegate = await db.rigaAttivita.count({
    where: { offertaId },
  });

  if (righeAttivitaCollegate > 0) {
    return { errore: MESSAGGIO_BLOCCO_ELIMINAZIONE };
  }

  try {
    await db.offerta.delete({ where: { id: offertaId } });
  } catch (error) {
    if (isPrismaForeignKeyConstraintError(error)) {
      return { errore: MESSAGGIO_BLOCCO_ELIMINAZIONE };
    }
    throw error;
  }

  revalidatePath("/offerte");
  revalidatePath("/anagrafiche/clienti");
  const filtri = leggiFiltriElencoOfferteDaForm(formData);
  redirect(
    urlPosizioneElenco("/offerte", filtri, {
      esito: "offerta-eliminata",
      ...parametriFiltroOfferte(filtri.soloDaPresidiare),
    }),
  );
}
