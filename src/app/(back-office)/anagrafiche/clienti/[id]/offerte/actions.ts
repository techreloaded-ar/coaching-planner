"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import { clientePerId } from "@/lib/clienti";
import {
  normalizzaTariffaGiornaliera,
  validaOfferta,
  type DatiOffertaInput,
  type ErroriValidazioneOfferta,
} from "@/domain/anagrafiche/valida-offerta";

export interface StatoActionOfferta {
  errori: ErroriValidazioneOfferta;
}

function datiDaForm(formData: FormData): DatiOffertaInput {
  return {
    codice: ((formData.get("codice") as string) ?? "").trim().toUpperCase(),
    descrizione: ((formData.get("descrizione") as string) ?? "").trim(),
    tariffaGiornaliera: ((formData.get("tariffaGiornaliera") as string) ?? "").trim(),
    giorniPrevisti: ((formData.get("giorniPrevisti") as string) ?? "").trim(),
  };
}

async function guardiaAmministratore(): Promise<void> {
  await richiediRuoloApi("AMMINISTRATORE");
}

function erroreCodiceDuplicato(): StatoActionOfferta {
  return {
    errori: {
      codice: "Esiste già un'offerta con questo codice per questo cliente",
    },
  };
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === "object" && error !== null && "code" in error)
  )
    ? (error as { code?: string }).code === "P2002"
    : false;
}

export async function creaOfferta(
  _prevState: StatoActionOfferta,
  formData: FormData
): Promise<StatoActionOfferta> {
  await guardiaAmministratore();

  const clienteId = formData.get("clienteId") as string;
  if (!clienteId) {
    return { errori: { _form: "Cliente mancante" } };
  }

  const cliente = await clientePerId(clienteId);
  if (!cliente) {
    return { errori: { _form: "Cliente non trovato" } };
  }

  if (!cliente.attivo) {
    return {
      errori: {
        _form: "Non puoi creare offerte per un cliente disattivato",
      },
    };
  }

  const dati = datiDaForm(formData);
  const errori = validaOfferta(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  const tariffa = normalizzaTariffaGiornaliera(dati.tariffaGiornaliera);
  if (!tariffa) {
    return {
      errori: {
        tariffaGiornaliera: "Importo non valido: usa massimo 2 decimali",
      },
    };
  }

  try {
    await db.offerta.create({
      data: {
        clienteId,
        codice: dati.codice,
        descrizione: dati.descrizione,
        tariffaGiornaliera: tariffa.valore,
        giorniPrevisti: parseInt(dati.giorniPrevisti, 10),
        attiva: true,
      },
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return erroreCodiceDuplicato();
    }
    throw error;
  }

  revalidatePath("/anagrafiche/clienti");
  revalidatePath(`/anagrafiche/clienti/${clienteId}`);
  redirect(`/anagrafiche/clienti/${clienteId}?esito=offerta-creata`);
}

export async function aggiornaOfferta(
  _prevState: StatoActionOfferta,
  formData: FormData
): Promise<StatoActionOfferta> {
  await guardiaAmministratore();

  const id = formData.get("id") as string;
  const clienteId = formData.get("clienteId") as string;

  if (!id) {
    return { errori: { _form: "ID offerta mancante" } };
  }

  if (!clienteId) {
    return { errori: { _form: "Cliente mancante" } };
  }

  const dati = datiDaForm(formData);
  const errori = validaOfferta(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  const tariffa = normalizzaTariffaGiornaliera(dati.tariffaGiornaliera);
  if (!tariffa) {
    return {
      errori: {
        tariffaGiornaliera: "Importo non valido: usa massimo 2 decimali",
      },
    };
  }

  try {
    await db.offerta.update({
      where: { id },
      data: {
        codice: dati.codice,
        descrizione: dati.descrizione,
        tariffaGiornaliera: tariffa.valore,
        giorniPrevisti: parseInt(dati.giorniPrevisti, 10),
      },
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return erroreCodiceDuplicato();
    }
    throw error;
  }

  revalidatePath("/anagrafiche/clienti");
  revalidatePath(`/anagrafiche/clienti/${clienteId}`);
  redirect(`/anagrafiche/clienti/${clienteId}?esito=offerta-salvata`);
}
