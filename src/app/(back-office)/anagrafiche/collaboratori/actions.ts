"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import {
  normalizzaTariffaGiornaliera,
  validaCollaboratore,
  type DatiCollaboratoreInput,
  type ErroriValidazione,
} from "@/domain/anagrafiche/valida-collaboratore";

// ── Tipi per useActionState ─────────────────────────────────────

export interface StatoAction {
  errori: ErroriValidazione;
  successo?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Estrae i dati del collaboratore dal FormData e li normalizza.
 */
function datiDaForm(formData: FormData): DatiCollaboratoreInput {
  return {
    nome: ((formData.get("nome") as string) ?? "").trim(),
    cognome: ((formData.get("cognome") as string) ?? "").trim(),
    email: ((formData.get("email") as string) ?? "").trim().toLowerCase(),
    partitaIva: ((formData.get("partitaIva") as string) ?? "").trim(),
    tariffaGiornaliera: ((formData.get("tariffaGiornaliera") as string) ?? "").trim(),
  };
}

/**
 * Verifica che l'utente sia amministratore.
 * Lancia ErroreAutorizzazione se non lo è.
 */
async function guardiaAmministratore(): Promise<void> {
  await richiediRuoloApi("AMMINISTRATORE");
}

/**
 * Verifica se l'errore è dovuto alla violazione del vincolo unique
 * sull'email dell'utente (P2002).
 */
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

// ── Server Actions ──────────────────────────────────────────────

/**
 * Crea un nuovo collaboratore, creando contestualmente l'utente
 * associato (ruolo COLLABORATORE) per l'accesso all'applicazione.
 *
 * Usabile con useActionState.
 */
export async function creaCollaboratore(
  _prevState: StatoAction,
  formData: FormData
): Promise<StatoAction> {
  await guardiaAmministratore();

  const dati = datiDaForm(formData);
  const errori = validaCollaboratore(dati);

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
    const esito = await db.$transaction(async (tx) => {
      const utenteEsistente = await tx.utente.findUnique({
        where: { email: dati.email },
        include: { collaboratore: { select: { id: true } } },
      });

      if (
        utenteEsistente &&
        (utenteEsistente.ruolo !== "AMMINISTRATORE" ||
          utenteEsistente.collaboratore)
      ) {
        return "EMAIL_DUPLICATA" as const;
      }

      const utente = utenteEsistente
        ? await tx.utente.update({
            where: { id: utenteEsistente.id },
            data: { nome: `${dati.nome} ${dati.cognome}` },
          })
        : await tx.utente.create({
            data: {
              email: dati.email,
              nome: `${dati.nome} ${dati.cognome}`,
              ruolo: "COLLABORATORE",
            },
          });

      await tx.collaboratore.create({
        data: {
          userId: utente.id,
          nome: dati.nome,
          cognome: dati.cognome,
          partitaIva: dati.partitaIva,
          tariffaGiornaliera: tariffa.valore,
          attivo: true,
        },
      });

      return "CREATO" as const;
    });

    if (esito === "EMAIL_DUPLICATA") {
      return erroreEmailDuplicata();
    }
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return erroreEmailDuplicata();
    }
    throw error;
  }

  revalidatePath("/anagrafiche/collaboratori");
  redirect("/anagrafiche/collaboratori?esito=creato");
}

/**
 * Aggiorna un collaboratore esistente, sincronizzando anche i dati
 * dell'utente associato (nome ed email di accesso).
 *
 * Usabile con useActionState.
 */
export async function aggiornaCollaboratore(
  _prevState: StatoAction,
  formData: FormData
): Promise<StatoAction> {
  await guardiaAmministratore();

  const id = formData.get("id") as string;
  if (!id) {
    return { errori: { _form: "ID collaboratore mancante" } };
  }

  const dati = datiDaForm(formData);
  const errori = validaCollaboratore(dati);

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

  const collaboratoreEsistente = await db.collaboratore.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!collaboratoreEsistente) {
    return { errori: { _form: "Collaboratore non trovato" } };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.collaboratore.update({
        where: { id },
        data: {
          nome: dati.nome,
          cognome: dati.cognome,
          partitaIva: dati.partitaIva,
          tariffaGiornaliera: tariffa.valore,
        },
      });

      await tx.utente.update({
        where: { id: collaboratoreEsistente.userId },
        data: {
          nome: `${dati.nome} ${dati.cognome}`,
          email: dati.email,
        },
      });
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return erroreEmailDuplicata();
    }
    throw error;
  }

  revalidatePath("/anagrafiche/collaboratori");
  redirect("/anagrafiche/collaboratori?esito=salvato");
}

/**
 * Attiva o disattiva un collaboratore (operazione reversibile,
 * nessuna cancellazione di dati).
 *
 * Usabile con useActionState.
 */
export async function cambiaStatoCollaboratore(
  _prevState: StatoAction,
  formData: FormData
): Promise<StatoAction> {
  await guardiaAmministratore();

  const id = formData.get("id") as string;
  const nuovoStato = formData.get("attivo") === "true";

  if (!id) {
    return { errori: { _form: "ID collaboratore mancante" } };
  }

  await db.collaboratore.update({
    where: { id },
    data: { attivo: nuovoStato },
  });

  revalidatePath("/anagrafiche/collaboratori");
  return {
    errori: {},
    successo: true,
  };
}
