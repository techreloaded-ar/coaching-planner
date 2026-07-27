"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  MESSAGGIO_ULTIMO_AMMINISTRATORE,
  violaProtezioneUltimoAmministratore,
} from "@/domain/anagrafiche/protezione-amministratore";
import {
  validaCensimentoUtente,
  validaModificaUtente,
  type DatiCensimentoUtenteInput,
  type DatiModificaUtenteInput,
  type ErroriValidazione,
} from "@/domain/anagrafiche/valida-utente";
import { normalizzaTariffaGiornaliera } from "@/domain/anagrafiche/valida-collaboratore";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";

export interface StatoAction {
  errori: ErroriValidazione;
  successo?: boolean;
}

function datiCensimentoDaForm(formData: FormData): DatiCensimentoUtenteInput {
  return {
    nome: ((formData.get("nome") as string) ?? "").trim(),
    email: ((formData.get("email") as string) ?? "").trim().toLowerCase(),
    ruoloAmministratore: formData.get("ruoloAmministratore") === "on",
    ruoloCollaboratore: formData.get("ruoloCollaboratore") === "on",
    cognome: ((formData.get("cognome") as string) ?? "").trim(),
    partitaIva: ((formData.get("partitaIva") as string) ?? "").trim(),
    tariffaGiornaliera: ((formData.get("tariffaGiornaliera") as string) ?? "")
      .trim(),
  };
}

function datiModificaDaForm(
  formData: FormData,
): Omit<DatiModificaUtenteInput, "profiloPresente"> {
  return {
    nome: ((formData.get("nome") as string) ?? "").trim(),
    email: ((formData.get("email") as string) ?? "").trim().toLowerCase(),
    ruoloAmministratore: formData.get("ruoloAmministratore") === "on",
    ruoloCollaboratore: formData.get("ruoloCollaboratore") === "on",
    cognome: ((formData.get("cognome") as string) ?? "").trim(),
    partitaIva: ((formData.get("partitaIva") as string) ?? "").trim(),
    tariffaGiornaliera: ((formData.get("tariffaGiornaliera") as string) ?? "")
      .trim(),
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

// Nella transazione di aggiornaUtente convivono due vincoli unique distinti
// (Utente.email e Collaboratore.userId): senza distinguerli, un conflitto
// sul profilo verrebbe segnalato all'amministratore come email duplicata.
function erroreVincoloUnicoAggiornamento(error: unknown): StatoAction {
  const meta =
    typeof error === "object" && error !== null && "meta" in error
      ? (error as { meta?: unknown }).meta
      : undefined;
  const target =
    typeof meta === "object" && meta !== null && "target" in meta
      ? (meta as { target?: unknown }).target
      : undefined;
  const campi = Array.isArray(target)
    ? target
    : typeof target === "string"
      ? [target]
      : [];
  const riguardaProfiloCollaboratore = campi.some(
    (campo) => typeof campo === "string" && campo.toLowerCase().includes("userid"),
  );

  return riguardaProfiloCollaboratore
    ? {
        errori: {
          _form: "Esiste già un profilo collaboratore per questo utente",
        },
      }
    : erroreEmailDuplicata();
}

export async function creaUtente(
  _prevState: StatoAction,
  formData: FormData,
): Promise<StatoAction> {
  await guardiaAmministratore();

  const dati = datiCensimentoDaForm(formData);
  const errori = validaCensimentoUtente(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  // validaCensimentoUtente ha già validato la tariffa (validaCampoTariffaGiornaliera):
  // per un utente Collaboratore normalizzaTariffaGiornaliera non può restituire null qui.
  // Manteniamo la chiamata solo per ottenere il valore normalizzato usato più sotto.
  const tariffa = dati.ruoloCollaboratore
    ? normalizzaTariffaGiornaliera(dati.tariffaGiornaliera)
    : null;

  try {
    const esito = await db.$transaction(async (tx) => {
      const utenteEsistente = await tx.utente.findUnique({
        where: { email: dati.email },
      });

      if (utenteEsistente) {
        return "EMAIL_DUPLICATA" as const;
      }

      const utente = await tx.utente.create({
        data: {
          nome: dati.ruoloCollaboratore
            ? `${dati.nome} ${dati.cognome}`
            : dati.nome,
          email: dati.email,
          ruolo: dati.ruoloAmministratore ? "AMMINISTRATORE" : "COLLABORATORE",
        },
      });

      if (dati.ruoloCollaboratore) {
        await tx.collaboratore.create({
          data: {
            userId: utente.id,
            nome: dati.nome,
            cognome: dati.cognome,
            partitaIva: dati.partitaIva,
            tariffaGiornaliera: tariffa!.valore,
            attivo: true,
          },
        });
      }

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

  revalidatePath("/anagrafiche/utenti");
  if (dati.ruoloCollaboratore) {
    revalidatePath("/anagrafiche/collaboratori");
  }
  redirect("/anagrafiche/utenti?esito=creato");
}

type EsitoAggiornamento =
  | "NON_TROVATO"
  | "ULTIMO_AMMINISTRATORE"
  | { stato: "AGGIORNATO"; profiloModificato: boolean };

export async function aggiornaUtente(
  _prevState: StatoAction,
  formData: FormData,
): Promise<StatoAction> {
  await guardiaAmministratore();

  const id = formData.get("id") as string;
  if (!id) {
    return { errori: { _form: "ID utente mancante" } };
  }

  const dati = datiModificaDaForm(formData);

  const utenteCorrente = await db.utente.findUnique({
    where: { id },
    include: { collaboratore: { select: { attivo: true } } },
  });

  if (!utenteCorrente) {
    return { errori: { _form: "Utente non trovato" } };
  }

  const profiloPresente = utenteCorrente.collaboratore !== null;

  const errori = validaModificaUtente({ ...dati, profiloPresente });
  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  const nuovoRuolo = dati.ruoloAmministratore
    ? "AMMINISTRATORE"
    : "COLLABORATORE";

  let esito: EsitoAggiornamento;

  try {
    esito = await eseguiConRetrySerializzazione(() =>
      db.$transaction(
        async (tx): Promise<EsitoAggiornamento> => {
          const utenteEsistente = await tx.utente.findUnique({
            where: { id },
            select: {
              ruolo: true,
              attivo: true,
              collaboratore: { select: { attivo: true } },
            },
          });

          if (!utenteEsistente) {
            return "NON_TROVATO";
          }

          if (
            utenteEsistente.ruolo === "AMMINISTRATORE" &&
            utenteEsistente.attivo &&
            nuovoRuolo !== "AMMINISTRATORE"
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
                { tipo: "CAMBIO_RUOLO", nuovoRuolo },
                altriAmministratoriAttivi,
              )
            ) {
              return "ULTIMO_AMMINISTRATORE";
            }
          }

          const profiloAttuale = utenteEsistente.collaboratore;
          // La decisione di creare il profilo è basata sulla lettura fatta
          // DENTRO la transazione (non su `profiloPresente` esterno, letto
          // prima di aprire la transazione): così un eventuale tentativo
          // concorrente di aggiungere lo stesso profilo, in isolamento
          // Serializable, produce un conflitto di serializzazione ritentato
          // da eseguiConRetrySerializzazione invece di una corsa fra due
          // `collaboratore.create` sullo stesso utente. L'invariante di sola
          // disattivazione (mai una delete) garantisce che se il profilo è
          // assente qui lo era anche alla lettura esterna usata per la
          // validazione, quindi i campi profilo erano già stati richiesti e
          // validati quando serve crearlo.
          const creaProfilo = dati.ruoloCollaboratore && profiloAttuale === null;
          const tariffa = creaProfilo
            ? normalizzaTariffaGiornaliera(dati.tariffaGiornaliera)
            : null;

          await tx.utente.update({
            where: { id },
            data: {
              email: dati.email,
              ruolo: nuovoRuolo,
              nome: creaProfilo ? `${dati.nome} ${dati.cognome}` : dati.nome,
            },
          });

          let profiloModificato = false;

          if (creaProfilo) {
            await tx.collaboratore.create({
              data: {
                userId: id,
                nome: dati.nome,
                cognome: dati.cognome,
                partitaIva: dati.partitaIva,
                tariffaGiornaliera: tariffa!.valore,
                attivo: true,
              },
            });
            profiloModificato = true;
          } else if (
            dati.ruoloCollaboratore &&
            profiloAttuale !== null &&
            !profiloAttuale.attivo
          ) {
            await tx.collaboratore.update({
              where: { userId: id },
              data: { attivo: true },
            });
            profiloModificato = true;
          } else if (
            !dati.ruoloCollaboratore &&
            profiloAttuale !== null &&
            profiloAttuale.attivo
          ) {
            await tx.collaboratore.update({
              where: { userId: id },
              data: { attivo: false },
            });
            profiloModificato = true;
          }

          return { stato: "AGGIORNATO", profiloModificato };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return erroreVincoloUnicoAggiornamento(error);
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
  if (esito.profiloModificato) {
    revalidatePath("/anagrafiche/collaboratori");
  }
  redirect("/anagrafiche/utenti?esito=salvato");
}
