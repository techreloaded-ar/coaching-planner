import { redirect } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";

export default async function AnagrafichePage() {
  await richiediRuolo("AMMINISTRATORE");
  redirect("/anagrafiche/clienti");
}
