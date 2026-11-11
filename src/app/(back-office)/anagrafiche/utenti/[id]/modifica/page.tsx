import { redirect } from "next/navigation";
import { richiediPermesso } from "@/lib/dal";

export default async function ModificaUtentePrecedente({ params }: { params: Promise<{ id: string }> }) {
  await richiediPermesso("GESTIRE_UTENTI");
  const { id } = await params;
  redirect(`/anagrafiche/persone/${encodeURIComponent(id)}`);
}
