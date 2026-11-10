import { redirect } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";

export default async function NuovoPrecedente() {
  await richiediRuolo("AMMINISTRATORE");
  redirect("/anagrafiche/persone/nuovo");
}
