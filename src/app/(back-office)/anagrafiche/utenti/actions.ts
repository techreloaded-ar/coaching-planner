"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  MESSAGGIO_ULTIMO_AMMINISTRATORE,
  violaProtezioneUltimoAmministratore,
} from "@/domain/anagrafiche/protezione-amministratore";
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

const MASSIMI_RITENTATIVI_SERIALIZZAZIONE = 3;

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === "object" && error !== null && "code" in error)
    ? (error as { code?: string }).code === "P2002"
    : false;
}

function isPrismaSerializationError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === "object" && error !== null && "code" in error)
    ? (error as { code?: string }).code === "P2034"
    : false;
}

async function eseguiConRetrySerializzazione<T>(
  operazione: () => Promise<T>,
): Promise<T> {
  for (let tentativo = 0; ; tentativo += 1) {
    try {
      return await operazione();
    } catch (error) {
      if (
        !isPrismaSerializationError(error) ||
        tentativo >= MASSIMI_RITENTATIVI_SERIALIZZAZIONE
      ) {
        throw error;
      }
    }
  }
}

function erroreEmailDuplicata(): StatoAction {
  return {
    errori: { email: "Esiste già un utente con questa email" },
  };
}

export async function creaUtente(
  _prevState: StatoAction,
  formData: FormData,
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
  formData: FormData,
): Promise<StatoAction> {
  await guardiaAmministratore();

  const id = formData.get("id") as string;
  if (!id) {
    return { errori: { _form: "ID utente mancante" } };
  }

  const dati = datiDaForm(formData);
  const errori = validaUtente(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  const ruolo = dati.ruolo as (typeof RUOLI_AMMESSI)[number];
  let esito: "NON_TROVATO" | "ULTIMO_AMMINISTRATORE" | "AGGIORNATO";

  try {
    esito = await eseguiConRetrySerializzazione(() =>
      db.$transaction(
        async (tx) => {
          const utenteEsistente = await tx.utente.findUnique({
            where: { id },
            select: { ruolo: true, attivo: true },
          });

          if (!utenteEsistente) {
            return "NON_TROVATO";
          }

          if (
            utenteEsistente.ruolo === "AMMINISTRATORE" &&
            utenteEsistente.attivo &&
            ruolo !== "AMMINISTRATORE"
          ) {
            const altriAmministratoriAttivi = await tx.utente.count({
              where: {
                ruolo: "AMMINISTRATORE",
                attivo: true,
                id: { not: id },
              },
            });

            if (
              violaProtezioneUltimoAmministratore(
                utenteEsistente,
                { tipo: "CAMBIO_RUOLO", nuovoRuolo: ruolo },
                altriAmministratoriAttivi,
              )
            ) {
              return "ULTIMO_AMMINISTRATORE";
            }
          }

          await tx.utente.update({
            where: { id },
            data: {
              nome: dati.nome,
              email: dati.email,
              ruolo,
            },
          });

          return "AGGIORNATO";
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return erroreEmailDuplicata();
    }
    throw error;
  }

  if (esito === "NON_TROVATO") {
    return { errori: { _form: "Utente non trovato" } };
  }

  if (esito === "ULTIMO_AMMINISTRATORE") {
    return { errori: { _form: MESSAGGIO_ULTIMO_AMMINISTRATORE } };
  }

  revalidatePath("/anagrafiche/utenti");
  redirect("/anagrafiche/utenti?esito=salvato");
}
