"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import { normalizzaTariffaGiornaliera } from "@/domain/anagrafiche/valida-collaboratore";
import {
  MESSAGGIO_MESE_TARIFFA_OCCUPATO,
  eModalitaTariffa,
  validaVoceTariffa,
} from "@/domain/tariffe";
import type { StatoAction } from "../actions";

function campo(formData: FormData, nome: string): string {
  return ((formData.get(nome) as string) ?? "").trim();
}

function aggiornaPagine(collaboratoreId: string): void {
  revalidatePath(`/anagrafiche/collaboratori/${collaboratoreId}`);
  revalidatePath("/anagrafiche/collaboratori");
}

/**
 * Aggiunge una voce allo storico tariffe del collaboratore o, se il form porta
 * `tariffaId`, modifica quella voce. Un mese può avere una sola voce.
 *
 * Usabile con useActionState.
 */
export async function salvaTariffaCollaboratore(
  _prevState: StatoAction,
  formData: FormData,
): Promise<StatoAction> {
  await richiediRuoloApi("AMMINISTRATORE");

  const collaboratoreId = campo(formData, "collaboratoreId");
  if (!collaboratoreId) {
    return { errori: { _form: "ID collaboratore mancante" } };
  }
  const tariffaId = campo(formData, "tariffaId") || null;

  const dati = {
    validaDalMese: campo(formData, "validaDalMese"),
    modalita: campo(formData, "modalita"),
    importo: campo(formData, "importo"),
  };
  const errori = validaVoceTariffa(dati);
  if (Object.keys(errori).length > 0 || !eModalitaTariffa(dati.modalita)) {
    return { errori };
  }
  const importo = normalizzaTariffaGiornaliera(dati.importo)!.valore;

  const meseOccupato = await db.tariffaCollaboratore.findFirst({
    where: {
      collaboratoreId,
      validaDalMese: dati.validaDalMese,
      ...(tariffaId ? { id: { not: tariffaId } } : {}),
    },
    select: { id: true },
  });
  if (meseOccupato) {
    return { errori: { validaDalMese: MESSAGGIO_MESE_TARIFFA_OCCUPATO } };
  }

  const valori = {
    validaDalMese: dati.validaDalMese,
    modalita: dati.modalita,
    importo,
  };

  try {
    if (tariffaId) {
      const { count } = await db.tariffaCollaboratore.updateMany({
        where: { id: tariffaId, collaboratoreId },
        data: valori,
      });
      if (count === 0) {
        return { errori: { _form: "Tariffa non trovata" } };
      }
    } else {
      await db.tariffaCollaboratore.create({
        data: { collaboratoreId, ...valori },
      });
    }
  } catch (error) {
    // Due salvataggi concorrenti sullo stesso mese: decide il vincolo unico.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { errori: { validaDalMese: MESSAGGIO_MESE_TARIFFA_OCCUPATO } };
    }
    throw error;
  }

  aggiornaPagine(collaboratoreId);
  return { errori: {}, successo: true };
}

/**
 * Elimina una voce dello storico tariffe. La voce più vecchia non è
 * eliminabile: un collaboratore ha sempre almeno una tariffa.
 *
 * Usabile con useActionState.
 */
export async function eliminaTariffaCollaboratore(
  _prevState: StatoAction,
  formData: FormData,
): Promise<StatoAction> {
  await richiediRuoloApi("AMMINISTRATORE");

  const collaboratoreId = campo(formData, "collaboratoreId");
  const tariffaId = campo(formData, "tariffaId");
  if (!collaboratoreId || !tariffaId) {
    return { errori: { _form: "Tariffa da eliminare mancante" } };
  }

  const piuVecchia = await db.tariffaCollaboratore.findFirst({
    where: { collaboratoreId },
    orderBy: { validaDalMese: "asc" },
    select: { id: true },
  });
  if (piuVecchia?.id === tariffaId) {
    return {
      errori: { _form: "La tariffa più vecchia non si può eliminare" },
    };
  }

  await db.tariffaCollaboratore.deleteMany({
    where: { id: tariffaId, collaboratoreId },
  });

  aggiornaPagine(collaboratoreId);
  return { errori: {}, successo: true };
}
