"use server";

import { Prisma } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { richiediRuoloApi } from "@/lib/dal";
import { ErroreImporter } from "@/lib/importer-legacy/errori";
import { parseDecisioni } from "@/lib/importer-legacy/decisioni";
import { applicaAnteprima, creaAnteprima } from "@/lib/importer-legacy/servizio";

function messaggioErrore(error: unknown, fase: "analisi" | "salvataggio", inizio: number) {
  if (error instanceof ErroreImporter) return error.message;
  // I messaggi Prisma possono contenere dati del foglio o parametri SQL:
  // registra solo metadati diagnostici, mai il payload o le credenziali.
  const codice = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  console.error("[importer-legacy] Operazione fallita", {
    fase, durataMs: Date.now() - inizio, tipo: error instanceof Error ? error.name : "sconosciuto", codice,
  });
  if (codice === "P2028") return "Transazione di importazione interrotta o scaduta. Nessuna modifica è stata salvata. Ripeti l’analisi e riprova.";
  if (codice === "P2034") return "I dati sono cambiati durante l’importazione. Nessuna modifica è stata salvata. Ripeti l’analisi e riprova.";
  return "Servizio non disponibile o dati cambiati durante l’operazione. Ripeti l’analisi; nessuna modifica parziale è stata salvata.";
}

export async function analizzaAction(form: FormData) {
  const user = await richiediRuoloApi("AMMINISTRATORE");
  const inizio = Date.now();
  let id: string;
  try {
    const mode = form.get("modalita");
    if (mode !== "INCREMENTALE" && mode !== "RESET") throw new ErroreImporter("Modalità non valida.");
    ({ id } = await creaAnteprima(user.utenteId, mode));
  } catch (error) {
    redirect(`/importazione?errore=${encodeURIComponent(messaggioErrore(error, "analisi", inizio))}`);
  }
  revalidatePath("/importazione");
  redirect(`/importazione?id=${encodeURIComponent(id)}`);
}

export async function importaAction(form: FormData) {
  await richiediRuoloApi("AMMINISTRATORE");
  const inizio = Date.now();
  const id = String(form.get("id") || "");
  try {
    await applicaAnteprima(id, String(form.get("revisione") || ""), parseDecisioni(form),
      form.getAll("clienteAI").filter((v): v is string => typeof v === "string"), String(form.get("confermaReset") || ""), form.get("confermaSenzaCodice") === "on");
  } catch (error) {
    redirect(`/importazione?id=${encodeURIComponent(id)}&errore=${encodeURIComponent(messaggioErrore(error, "salvataggio", inizio))}`);
  }
  revalidatePath("/importazione");
  revalidatePath("/attivita");
  revalidatePath("/report");
  redirect("/importazione?salvata=1");
}
