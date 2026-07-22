"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import type { StatoAction } from "../actions";

/**
 * Abilita uno o più collaboratori su un insieme di offerte in un'unica
 * conferma. L'operazione è idempotente: le coppie già presenti vengono
 * ignorate grazie al vincolo unico (collaboratoreId, offertaId).
 *
 * Usabile con useActionState.
 */
export async function abilitaCollaboratoreSuOfferte(
  _prevState: StatoAction,
  formData: FormData
): Promise<StatoAction> {
  await richiediRuoloApi("AMMINISTRATORE");

  const collaboratoreId = formData.get("collaboratoreId") as string;
  if (!collaboratoreId) {
    return { errori: { _form: "ID collaboratore mancante" } };
  }

  const idsOfferte = formData
    .getAll("offertaId")
    .filter((valore): valore is string => typeof valore === "string" && valore.length > 0);

  if (idsOfferte.length === 0) {
    return { errori: { _form: "Seleziona almeno un'offerta da abilitare" } };
  }

  const offerteDisponibili = await db.offerta.findMany({
    where: { id: { in: idsOfferte }, attiva: true },
    select: { id: true },
  });

  if (offerteDisponibili.length !== idsOfferte.length) {
    return {
      errori: { _form: "Alcune offerte selezionate non sono disponibili" },
    };
  }

  await db.abilitazioneOfferta.createMany({
    data: idsOfferte.map((offertaId) => ({ collaboratoreId, offertaId })),
    skipDuplicates: true,
  });

  revalidatePath(`/anagrafiche/collaboratori/${collaboratoreId}`);
  return { errori: {}, successo: true };
}

/**
 * Revoca una singola abilitazione collaboratore–offerta. L'operazione è
 * idempotente e tocca esclusivamente la coppia bersaglio.
 *
 * Usabile con useActionState.
 */
export async function revocaAbilitazioneCollaboratore(
  _prevState: StatoAction,
  formData: FormData
): Promise<StatoAction> {
  await richiediRuoloApi("AMMINISTRATORE");

  const collaboratoreId = formData.get("collaboratoreId") as string;
  const offertaId = formData.get("offertaId") as string;

  if (!collaboratoreId) {
    return { errori: { _form: "ID collaboratore mancante" } };
  }

  if (!offertaId) {
    return { errori: { _form: "ID offerta mancante" } };
  }

  await db.abilitazioneOfferta.deleteMany({
    where: { collaboratoreId, offertaId },
  });

  revalidatePath(`/anagrafiche/collaboratori/${collaboratoreId}`);
  return { errori: {}, successo: true };
}
