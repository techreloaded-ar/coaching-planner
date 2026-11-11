import { redirect } from "next/navigation";
import { richiediPermesso } from "@/lib/dal";

export default async function ReportAvanzamentoOffertePage() {
  await richiediPermesso("GESTIRE_OFFERTE");
  redirect("/offerte");
}
