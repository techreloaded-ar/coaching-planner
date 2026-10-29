import { redirect } from "next/navigation";

/** L'ingresso alle Impostazioni apre la prima categoria. */
export default function ImpostazioniPage() {
  redirect("/impostazioni/tema");
}
