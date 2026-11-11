"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { richiediPermessoApi } from "@/lib/dal";
import { clientePerId } from "@/lib/clienti";
import {
  normalizzaTariffaGiornaliera,
  validaOfferta,
  type DatiOffertaInput,
  type ErroriValidazioneOfferta,
} from "@/domain/anagrafiche/valida-offerta";
import type { GestioneTrasferta } from "@/domain/types";
import { leggiNoteDaForm, leggiTestoFacoltativoDaForm } from "@/domain/anagrafiche/note";

export interface StatoActionOfferta {
  errori: ErroriValidazioneOfferta;
}

function datiDaForm(formData: FormData): DatiOffertaInput {
  return {
    codice: ((formData.get("codice") as string) ?? "").trim().toUpperCase(),
    descrizione: ((formData.get("descrizione") as string) ?? "").trim(),
    tariffaGiornaliera: ((formData.get("tariffaGiornaliera") as string) ?? "").trim(),
    giorniPrevisti: ((formData.get("giorniPrevisti") as string) ?? "").trim(),
    gestioneTrasferta: (formData.get("gestioneTrasferta") as string) ?? "",
    importoTrasfertaForfettaria: (
      (formData.get("importoTrasfertaForfettaria") as string) ?? ""
    ).trim(),
  };
}

/**
 * Condizioni di trasferta da salvare: con la trasferta inclusa l'importo
 * forfettario viene azzerato. Da chiamare solo su dati già validati.
 */
function condizioniTrasferta(dati: DatiOffertaInput): {
  gestioneTrasferta: GestioneTrasferta;
  importoTrasfertaForfettaria: string | null;
} {
  if (dati.gestioneTrasferta === "FORFETTARIA") {
    return {
      gestioneTrasferta: "FORFETTARIA",
      importoTrasfertaForfettaria:
        normalizzaTariffaGiornaliera(dati.importoTrasfertaForfettaria)?.valore ?? null,
    };
  }
  return { gestioneTrasferta: "INCLUSA", importoTrasfertaForfettaria: null };
}

/**
 * Tariffa giornaliera e giorni previsti: null se non valorizzati.
 * Da chiamare solo su dati già validati.
 */
function valoriFacoltativi(dati: DatiOffertaInput): {
  tariffaGiornaliera: string | null;
  giorniPrevisti: number | null;
} {
  return {
    tariffaGiornaliera:
      normalizzaTariffaGiornaliera(dati.tariffaGiornaliera)?.valore ?? null,
    giorniPrevisti: dati.giorniPrevisti ? parseInt(dati.giorniPrevisti, 10) : null,
  };
}

async function guardiaGestioneOfferte(): Promise<void> {
  await richiediPermessoApi("GESTIRE_OFFERTE");
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
  await guardiaGestioneOfferte();

  const clienteId = formData.get("clienteId") as string;
  if (!clienteId) {
    return { errori: { _form: "Cliente mancante" } };
  }

  const provieneDaPaginaOfferte =
    ((formData.get("origine") as string) ?? "") === "offerte";

  const cliente = await clientePerId(clienteId);
  if (!cliente) {
    return { errori: { _form: "Cliente non trovato" } };
  }

  const dati = datiDaForm(formData);
  const errori = validaOfferta(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  try {
    await db.offerta.create({
      data: {
        clienteId,
        codice: dati.codice,
        descrizione: dati.descrizione,
        ...valoriFacoltativi(dati),
        ...condizioniTrasferta(dati),
        numeroOrdine: leggiTestoFacoltativoDaForm(formData, "numeroOrdine"),
        accountAgileReloaded: leggiTestoFacoltativoDaForm(formData, "accountAgileReloaded"),
        note: leggiNoteDaForm(formData),
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

  if (provieneDaPaginaOfferte) {
    revalidatePath("/offerte");
    redirect("/offerte?esito=offerta-creata");
  }

  redirect(`/anagrafiche/clienti/${clienteId}?esito=offerta-creata`);
}

export async function aggiornaOfferta(
  _prevState: StatoActionOfferta,
  formData: FormData
): Promise<StatoActionOfferta> {
  await guardiaGestioneOfferte();

  const id = formData.get("id") as string;
  const clienteId = formData.get("clienteId") as string;

  if (!id) {
    return { errori: { _form: "ID offerta mancante" } };
  }

  if (!clienteId) {
    return { errori: { _form: "Cliente mancante" } };
  }

  const provieneDaPaginaOfferte =
    ((formData.get("origine") as string) ?? "") === "offerte";

  const dati = datiDaForm(formData);
  const errori = validaOfferta(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  try {
    await db.offerta.update({
      where: { id },
      data: {
        codice: dati.codice,
        descrizione: dati.descrizione,
        ...valoriFacoltativi(dati),
        ...condizioniTrasferta(dati),
        numeroOrdine: leggiTestoFacoltativoDaForm(formData, "numeroOrdine"),
        accountAgileReloaded: leggiTestoFacoltativoDaForm(formData, "accountAgileReloaded"),
        note: leggiNoteDaForm(formData),
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

  if (provieneDaPaginaOfferte) {
    revalidatePath("/offerte");
    redirect("/offerte?esito=offerta-salvata");
  }

  redirect(`/anagrafiche/clienti/${clienteId}?esito=offerta-salvata`);
}

/**
 * Disattiva o riattiva una singola offerta dal dettaglio cliente (campi `id`,
 * `clienteId`, `attivo` "true"/"false") e torna al dettaglio con l'esito.
 * Il filtro su `clienteId` impedisce di toccare offerte di altri clienti.
 */
export async function cambiaStatoOffertaCliente(formData: FormData): Promise<void> {
  await guardiaGestioneOfferte();

  const id = formData.get("id");
  const clienteId = formData.get("clienteId");
  if (typeof clienteId !== "string" || !clienteId) {
    redirect("/anagrafiche/clienti");
  }
  if (typeof id !== "string" || !id) {
    redirect(`/anagrafiche/clienti/${clienteId}`);
  }

  const attiva = formData.get("attivo") === "true";

  await db.offerta.updateMany({
    where: { id, clienteId },
    data: { attiva },
  });

  revalidatePath("/anagrafiche/clienti");
  revalidatePath(`/anagrafiche/clienti/${clienteId}`);
  revalidatePath("/offerte");

  redirect(
    `/anagrafiche/clienti/${clienteId}?esito=${attiva ? "offerta-riattivata" : "offerta-disattivata"}`,
  );
}
