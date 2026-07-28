import { redirect } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";

export default async function NuovoCollaboratorePage() {
  await richiediRuolo("AMMINISTRATORE");

  redirect("/anagrafiche/utenti");
}
