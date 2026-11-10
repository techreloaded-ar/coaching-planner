import { redirect } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";

export default async function ModificaUtentePrecedente({ params }: { params: Promise<{ id: string }> }) {
  await richiediRuolo("AMMINISTRATORE");
  const { id } = await params;
  redirect(`/anagrafiche/persone/${encodeURIComponent(id)}`);
}
