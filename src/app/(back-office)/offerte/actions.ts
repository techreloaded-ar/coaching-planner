"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";

const MESSAGGIO_BLOCCO_ELIMINAZIONE =
  "Impossibile eliminare l'offerta: esistono righe attività collegate. Disattiva l'offerta invece di eliminarla.";

async function guardiaAmministratore(): Promise<void> {
  await richiediRuoloApi("AMMINISTRATORE");
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
 * Server action per attivare/disattivare un'offerta.
 * Chiamata direttamente dai form nella pagina offerte.
 */
export async function cambiaStatoOfferta(formData: FormData): Promise<void> {
  await guardiaAmministratore();

  const id = formData.get("id") as string;
  const attiva = formData.get("attiva") === "true";
  const offertaEspansaId = formData.get("offertaEspansaId");

  if (!id) {
    redirect("/offerte");
  }

  await db.offerta.update({
    where: { id },
    data: { attiva },
  });

  revalidatePath("/offerte");

  const parametriRedirect = new URLSearchParams({
    esito: "stato-offerta-aggiornato",
  });
  if (typeof offertaEspansaId === "string" && offertaEspansaId) {
    parametriRedirect.set("offertaEspansaId", offertaEspansaId);
  }
  redirect(`/offerte?${parametriRedirect.toString()}`);
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
  await guardiaAmministratore();

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
  redirect("/offerte?esito=offerta-eliminata");
}
