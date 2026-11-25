"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { richiediPermessoApi } from "@/lib/dal";
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

async function guardiaGestioneVociRimborso(): Promise<void> {
  await richiediPermessoApi("GESTIRE_VOCI_RIMBORSO");
}

export async function creaVoceRimborso(
  _prevState: StatoActionVoceRimborso,
  formData: FormData
): Promise<StatoActionVoceRimborso> {
  await guardiaGestioneVociRimborso();

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
  await guardiaGestioneVociRimborso();

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

/** Esito di un'eliminazione rifiutata; quella riuscita termina con un redirect. */
export interface StatoEliminazioneVoceRimborso {
  errori: Record<string, string>;
}

/**
 * Server action per eliminare una voce di rimborso trasferta, chiamata dalla
 * conferma nella tabella. Se riesce porta all'elenco con l'esito «eliminato»;
 * altrimenti restituisce il motivo, così la tabella rimette la riga al suo
 * posto e lo mostra.
 */
export async function eliminaVoceRimborso(
  formData: FormData,
): Promise<StatoEliminazioneVoceRimborso> {
  await guardiaGestioneVociRimborso();

  const id = formData.get("id") as string;
  if (!id) {
    return { errori: { _form: "Voce di rimborso da eliminare mancante" } };
  }

  try {
    await db.voceRimborsoTrasferta.delete({ where: { id } });
  } catch (error) {
    // Voce già eliminata altrove: l'elenco si riallinea e l'utente lo sa.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      revalidatePath("/anagrafiche/voci-rimborso");
      return {
        errori: {
          _form: "La voce non esiste più: potrebbe essere già stata eliminata",
        },
      };
    }
    throw error;
  }

  revalidatePath("/anagrafiche/voci-rimborso");
  redirect("/anagrafiche/voci-rimborso?esito=eliminato");
}
