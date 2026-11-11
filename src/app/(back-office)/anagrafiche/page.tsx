import { redirect } from "next/navigation";
import { richiediPermesso } from "@/lib/dal";

export default async function AnagrafichePage() {
  await richiediPermesso("GESTIRE_CLIENTI");
  redirect("/anagrafiche/clienti");
}
