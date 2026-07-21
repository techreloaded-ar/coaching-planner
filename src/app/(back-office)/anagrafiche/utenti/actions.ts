"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  RUOLI_AMMESSI,
  validaUtente,
  type DatiUtenteInput,
  type ErroriValidazione,
} from "@/domain/anagrafiche/valida-utente";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";

export interface StatoAction {
  errori: ErroriValidazione;
  successo?: boolean;
}

function datiDaForm(formData: FormData): DatiUtenteInput {
  return {
    nome: ((formData.get("nome") as string) ?? "").trim(),
    email: ((formData.get("email") as string) ?? "").trim().toLowerCase(),
    ruolo: (formData.get("ruolo") as string) ?? "",
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

function erroreEmailDuplicata(): StatoAction {
  return {
    errori: { email: "Esiste già un utente con questa email" },
  };
}

export async function creaUtente(
  _prevState: StatoAction,
  formData: FormData
): Promise<StatoAction> {
  await guardiaAmministratore();

  const dati = datiDaForm(formData);
  const errori = validaUtente(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  try {
    const utenteEsistente = await db.utente.findUnique({
      where: { email: dati.email },
    });

    if (utenteEsistente) {
      return erroreEmailDuplicata();
    }

    await db.utente.create({
      data: {
        nome: dati.nome,
        email: dati.email,
        ruolo: dati.ruolo as (typeof RUOLI_AMMESSI)[number],
      },
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return erroreEmailDuplicata();
    }
    throw error;
  }

  revalidatePath("/anagrafiche/utenti");
  redirect("/anagrafiche/utenti?esito=creato");
}

export async function aggiornaUtente(
  _prevState: StatoAction,
  formData: FormData
): Promise<StatoAction> {
  await guardiaAmministratore();

  const id = formData.get("id") as string;
  if (!id) {
    return { errori: { _form: "ID utente mancante" } };
  }

  const utenteEsistente = await db.utente.findUnique({
    where: { id },
    select: { ruolo: true },
  });

  if (!utenteEsistente) {
    return { errori: { _form: "Utente non trovato" } };
  }

  const dati = datiDaForm(formData);
  const errori = validaUtente({
    ...dati,
    ruolo: utenteEsistente.ruolo,
  });

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  try {
    await db.utente.update({
      where: { id },
      data: {
        nome: dati.nome,
        email: dati.email,
      },
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return erroreEmailDuplicata();
    }
    throw error;
  }

  revalidatePath("/anagrafiche/utenti");
  redirect("/anagrafiche/utenti?esito=salvato");
}
