"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import { normalizzaTariffaGiornaliera } from "@/domain/anagrafiche/valida-offerta";
import {
  validaVoceRimborso,
  type DatiVoceRimborsoInput,
  type ErroriValidazioneVoceRimborso,
} from "@/domain/anagrafiche/valida-voce-rimborso";

export interface StatoActionVoceRimborso {
  errori: ErroriValidazioneVoceRimborso;
}

function datiDaForm(formData: FormData): DatiVoceRimborsoInput {
  return {
    etichetta: ((formData.get("etichetta") as string) ?? "").trim(),
    importo: ((formData.get("importo") as string) ?? "").trim(),
  };
}

async function guardiaAmministratore(): Promise<void> {
  await richiediRuoloApi("AMMINISTRATORE");
}

export async function creaVoceRimborso(
  _prevState: StatoActionVoceRimborso,
  formData: FormData
): Promise<StatoActionVoceRimborso> {
  await guardiaAmministratore();

  const dati = datiDaForm(formData);
  const errori = validaVoceRimborso(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  const importo = normalizzaTariffaGiornaliera(dati.importo)!;

  await db.voceRimborsoTrasferta.create({
    data: {
      etichetta: dati.etichetta,
      importo: importo.valore,
    },
  });

  revalidatePath("/anagrafiche/voci-rimborso");
  redirect("/anagrafiche/voci-rimborso?esito=creato");
}

export async function aggiornaVoceRimborso(
  _prevState: StatoActionVoceRimborso,
  formData: FormData
): Promise<StatoActionVoceRimborso> {
  await guardiaAmministratore();

  const id = formData.get("id") as string;
  if (!id) {
    return { errori: { _form: "ID voce di rimborso mancante" } };
  }

  const dati = datiDaForm(formData);
  const errori = validaVoceRimborso(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  const importo = normalizzaTariffaGiornaliera(dati.importo)!;

  await db.voceRimborsoTrasferta.update({
    where: { id },
    data: {
      etichetta: dati.etichetta,
      importo: importo.valore,
    },
  });

  revalidatePath("/anagrafiche/voci-rimborso");
  redirect("/anagrafiche/voci-rimborso?esito=salvato");
}

/**
 * Server action per eliminare una voce di rimborso trasferta.
 * Chiamata direttamente dal form di conferma nella tabella.
 */
export async function eliminaVoceRimborso(formData: FormData): Promise<void> {
  await guardiaAmministratore();

  const id = formData.get("id") as string;
  if (!id) {
    redirect("/anagrafiche/voci-rimborso");
  }

  await db.voceRimborsoTrasferta.delete({ where: { id } });

  revalidatePath("/anagrafiche/voci-rimborso");
  redirect("/anagrafiche/voci-rimborso?esito=eliminato");
}
