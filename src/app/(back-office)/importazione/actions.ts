"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { richiediRuoloApi } from "@/lib/dal";
import { ErroreImporter } from "@/lib/importer-legacy/errori";
import { parseDecisioni } from "@/lib/importer-legacy/decisioni";
import { applicaAnteprima, creaAnteprima } from "@/lib/importer-legacy/servizio";

function messaggioErrore(error: unknown) {
  if (error instanceof ErroreImporter) return error.message;
  return "Servizio non disponibile o dati cambiati durante l’operazione. Ripeti l’analisi; nessuna modifica parziale è stata salvata.";
}

export async function analizzaAction(form: FormData) {
  const user = await richiediRuoloApi("AMMINISTRATORE");
  let id: string;
  try {
    const mode = form.get("modalita");
    if (mode !== "INCREMENTALE" && mode !== "RESET") throw new ErroreImporter("Modalità non valida.");
    ({ id } = await creaAnteprima(user.utenteId, mode));
  } catch (error) {
    redirect(`/importazione?errore=${encodeURIComponent(messaggioErrore(error))}`);
  }
  revalidatePath("/importazione");
  redirect(`/importazione?id=${encodeURIComponent(id)}`);
}

export async function importaAction(form: FormData) {
  await richiediRuoloApi("AMMINISTRATORE");
  const id = String(form.get("id") || "");
  try {
    await applicaAnteprima(id, String(form.get("revisione") || ""), parseDecisioni(form),
      form.getAll("clienteAI").filter((v): v is string => typeof v === "string"), String(form.get("confermaReset") || ""), form.get("confermaSenzaCodice") === "on");
  } catch (error) {
    redirect(`/importazione?id=${encodeURIComponent(id)}&errore=${encodeURIComponent(messaggioErrore(error))}`);
  }
  revalidatePath("/importazione");
  revalidatePath("/attivita");
  revalidatePath("/report");
  redirect("/importazione?salvata=1");
}
