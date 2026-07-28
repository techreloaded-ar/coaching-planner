"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";

// ── Tipi per useActionState ─────────────────────────────────────

export interface StatoIngaggiAction {
  errori: Record<string, string>;
  successo?: boolean;
}

/**
 * Ingaggia uno o più collaboratori attivi su un'offerta in un'unica
 * conferma. L'operazione è idempotente: le coppie già presenti vengono
 * ignorate grazie al vincolo unico (collaboratoreId, offertaId).
 *
 * Usabile con useActionState.
 */
export async function ingaggiaCollaboratoriSuOfferta(
  _prevState: StatoIngaggiAction,
  formData: FormData
): Promise<StatoIngaggiAction> {
  await richiediRuoloApi("AMMINISTRATORE");

  const offertaId = formData.get("offertaId") as string;
  if (!offertaId) {
    return { errori: { _form: "ID offerta mancante" } };
  }

  const idsCollaboratori = formData
    .getAll("collaboratoreId")
    .filter((valore): valore is string => typeof valore === "string" && valore.length > 0);

  if (idsCollaboratori.length === 0) {
    return { errori: { _form: "Seleziona almeno un collaboratore da ingaggiare" } };
  }

  const offerta = await db.offerta.findUnique({
    where: { id: offertaId },
    select: { attiva: true },
  });

  if (!offerta) {
    return { errori: { _form: "Offerta non trovata" } };
  }

  if (!offerta.attiva) {
    return { errori: { _form: "L'offerta non è attiva" } };
  }

  const collaboratoriDisponibili = await db.collaboratore.findMany({
    where: { id: { in: idsCollaboratori }, attivo: true },
    select: { id: true },
  });

  if (collaboratoriDisponibili.length !== idsCollaboratori.length) {
    return {
      errori: { _form: "Alcuni collaboratori selezionati non sono disponibili" },
    };
  }

  await db.abilitazioneOfferta.createMany({
    data: idsCollaboratori.map((collaboratoreId) => ({ collaboratoreId, offertaId })),
    skipDuplicates: true,
  });

  revalidatePath(`/offerte/${offertaId}/collaboratori`);
  for (const collaboratoreId of idsCollaboratori) {
    revalidatePath(`/anagrafiche/collaboratori/${collaboratoreId}`);
  }

  return { errori: {}, successo: true };
}

/**
 * Revoca un singolo ingaggio collaboratore–offerta. L'operazione è
 * idempotente e tocca esclusivamente la coppia bersaglio.
 *
 * Usabile con useActionState.
 */
export async function revocaIngaggioCollaboratore(
  _prevState: StatoIngaggiAction,
  formData: FormData
): Promise<StatoIngaggiAction> {
  await richiediRuoloApi("AMMINISTRATORE");

  const offertaId = formData.get("offertaId") as string;
  const collaboratoreId = formData.get("collaboratoreId") as string;

  if (!offertaId) {
    return { errori: { _form: "ID offerta mancante" } };
  }

  if (!collaboratoreId) {
    return { errori: { _form: "ID collaboratore mancante" } };
  }

  await db.abilitazioneOfferta.deleteMany({
    where: { collaboratoreId, offertaId },
  });

  revalidatePath(`/offerte/${offertaId}/collaboratori`);
  revalidatePath(`/anagrafiche/collaboratori/${collaboratoreId}`);

  return { errori: {}, successo: true };
}
