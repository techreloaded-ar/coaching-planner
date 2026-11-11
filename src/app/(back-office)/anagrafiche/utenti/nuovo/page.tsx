import { redirect } from "next/navigation";
import { richiediPermesso } from "@/lib/dal";

export default async function NuovoPrecedente() {
  await richiediPermesso("GESTIRE_UTENTI");
  redirect("/anagrafiche/persone/nuovo");
}
