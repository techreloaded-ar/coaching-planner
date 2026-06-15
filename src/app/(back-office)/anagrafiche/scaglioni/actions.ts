"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import { elencaScaglioni } from "@/lib/scaglioni";
import { normalizzaTariffaGiornaliera } from "@/domain/anagrafiche/valida-offerta";
import {
  validaScaglione,
  verificaSogliaUnica,
  type DatiScaglioneInput,
  type ErroriValidazioneScaglione,
} from "@/domain/anagrafiche/valida-scaglione";

export interface StatoActionScaglione {
  errori: ErroriValidazioneScaglione;
}

const ERRORE_SOGLIA_DUPLICATA =
  "Esiste già uno scaglione con questa soglia: le soglie non possono sovrapporsi";

function datiDaForm(formData: FormData): DatiScaglioneInput {
  return {
    finoAKm: ((formData.get("finoAKm") as string) ?? "").trim(),
    importo: ((formData.get("importo") as string) ?? "").trim(),
  };
}

async function guardiaAmministratore(): Promise<void> {
  await richiediRuoloApi("AMMINISTRATORE");
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === "object" && error !== null && "code" in error)
  )
    ? (error as { code?: string }).code === "P2002"
    : false;
}

export async function creaScaglione(
  _prevState: StatoActionScaglione,
  formData: FormData
): Promise<StatoActionScaglione> {
  await guardiaAmministratore();

  const dati = datiDaForm(formData);
  const errori = validaScaglione(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  const finoAKm = parseInt(dati.finoAKm, 10);
  const importo = normalizzaTariffaGiornaliera(dati.importo)!;

  const esistenti = await elencaScaglioni();
  const erroreSoglia = verificaSogliaUnica(finoAKm, esistenti);
  if (erroreSoglia) {
    return { errori: { finoAKm: erroreSoglia } };
  }

  try {
    await db.scaglioneKm.create({
      data: {
        finoAKm,
        importo: importo.valore,
      },
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return { errori: { finoAKm: ERRORE_SOGLIA_DUPLICATA } };
    }
    throw error;
  }

  revalidatePath("/anagrafiche/scaglioni");
  redirect("/anagrafiche/scaglioni?esito=creato");
}

export async function aggiornaScaglione(
  _prevState: StatoActionScaglione,
  formData: FormData
): Promise<StatoActionScaglione> {
  await guardiaAmministratore();

  const id = formData.get("id") as string;
  if (!id) {
    return { errori: { _form: "ID scaglione mancante" } };
  }

  const dati = datiDaForm(formData);
  const errori = validaScaglione(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  const finoAKm = parseInt(dati.finoAKm, 10);
  const importo = normalizzaTariffaGiornaliera(dati.importo)!;

  const esistenti = await elencaScaglioni();
  const erroreSoglia = verificaSogliaUnica(finoAKm, esistenti, id);
  if (erroreSoglia) {
    return { errori: { finoAKm: erroreSoglia } };
  }

  try {
    await db.scaglioneKm.update({
      where: { id },
      data: {
        finoAKm,
        importo: importo.valore,
      },
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return { errori: { finoAKm: ERRORE_SOGLIA_DUPLICATA } };
    }
    throw error;
  }

  revalidatePath("/anagrafiche/scaglioni");
  redirect("/anagrafiche/scaglioni?esito=salvato");
}

/**
 * Server action per eliminare uno scaglione km.
 * Chiamata direttamente dal form di conferma nella tabella scaglioni.
 */
export async function eliminaScaglione(formData: FormData): Promise<void> {
  await guardiaAmministratore();

  const id = formData.get("id") as string;
  if (!id) {
    redirect("/anagrafiche/scaglioni");
  }

  await db.scaglioneKm.delete({ where: { id } });

  revalidatePath("/anagrafiche/scaglioni");
  redirect("/anagrafiche/scaglioni?esito=eliminato");
}
